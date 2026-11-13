package xyz.mpv.rex.carreel

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class FeedTab(val apiValue: String, val label: String) {
  FOLLOWING("following", "Following"),
  FOR_YOU("foryou", "For You"),
  AUCTIONS("auctions", "Live Auctions"),
}

data class FeedState(
  val tab: FeedTab = FeedTab.FOR_YOU,
  val category: String? = null,
  val items: List<Listing> = emptyList(),
  val nextCursor: String? = "0",
  val loading: Boolean = false,
  val error: String? = null,
  /** Bumped on every reset so the pager can jump back to the top. */
  val generation: Int = 0,
)

class CarReelViewModel(app: Application) : AndroidViewModel(app) {
  private val prefs = app.getSharedPreferences("carreel", Context.MODE_PRIVATE)

  private val _serverUrl = MutableStateFlow(prefs.getString(KEY_URL, null) ?: CarReelApi.DEFAULT_URL)
  val serverUrl = _serverUrl.asStateFlow()
  var api = CarReelApi(_serverUrl.value) { prefs.getString(KEY_TOKEN, null) }
    private set

  private val _state = MutableStateFlow(FeedState())
  val state = _state.asStateFlow()
  private val _meta = MutableStateFlow<Meta?>(null)
  val meta = _meta.asStateFlow()
  private val _user = MutableStateFlow<CrUser?>(null)
  val user = _user.asStateFlow()
  private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 4)
  val messages = _messages.asSharedFlow()
  /** Set when an action needs a signed-in user; the screen shows the sign-in sheet. */
  val signInRequested = MutableStateFlow(false)

  private var loadJob: Job? = null

  init { refreshAll() }

  private fun refreshAll() {
    viewModelScope.launch { runCatching { api.meta() }.onSuccess { _meta.value = it } }
    if (prefs.getString(KEY_TOKEN, null) != null) {
      viewModelScope.launch {
        runCatching { api.me() }.onSuccess { _user.value = it }.onFailure { if ((it as? ApiException)?.status == 401) signOut() }
      }
    }
    reload()
  }

  fun setServerUrl(url: String) {
    val clean = url.trim().trimEnd('/')
    if (clean.isEmpty() || clean == _serverUrl.value) return
    prefs.edit().putString(KEY_URL, clean).remove(KEY_TOKEN).apply()
    _serverUrl.value = clean
    _user.value = null
    api = CarReelApi(clean) { prefs.getString(KEY_TOKEN, null) }
    refreshAll()
  }

  fun selectTab(tab: FeedTab) { if (tab != _state.value.tab) { _state.update { it.copy(tab = tab) }; reload() } }
  fun selectCategory(slug: String?) { if (slug != _state.value.category) { _state.update { it.copy(category = slug) }; reload() } }

  fun reload() {
    loadJob?.cancel()
    _state.update { it.copy(items = emptyList(), nextCursor = "0", error = null, generation = it.generation + 1) }
    loadMore()
  }

  fun loadMore() {
    val s = _state.value
    val cursor = s.nextCursor ?: return
    if (s.loading && loadJob?.isActive == true) return
    _state.update { it.copy(loading = true) }
    loadJob = viewModelScope.launch {
      try {
        val page = api.feed(s.tab.apiValue, s.category, cursor)
        _state.update { cur ->
          val seen = cur.items.mapTo(HashSet()) { it.id }
          cur.copy(items = cur.items + page.items.filter { it.id !in seen }, nextCursor = page.nextCursor, loading = false, error = null)
        }
      } catch (e: kotlinx.coroutines.CancellationException) {
        throw e
      } catch (e: Exception) {
        _state.update { it.copy(loading = false, error = e.message ?: "Can't reach ${api.baseUrl}") }
      }
    }
  }

  private fun replace(id: String, f: (Listing) -> Listing) =
    _state.update { s -> s.copy(items = s.items.map { if (it.id == id) f(it) else it }) }

  private fun authed(block: suspend () -> Unit) {
    if (_user.value == null) { signInRequested.value = true; return }
    viewModelScope.launch {
      try { block() } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) { _messages.tryEmit(e.message ?: "Something went wrong") }
    }
  }

  /** [onlyLike] is used by double-tap: it likes but never un-likes, like TikTok. */
  fun toggleLike(l: Listing, onlyLike: Boolean = false) = authed {
    if (onlyLike && l.liked) return@authed
    replace(l.id) { it.copy(liked = !it.liked, stats = it.stats.copy(likes = it.stats.likes + if (it.liked) -1 else 1)) }
    val r = api.like(l.id)
    replace(l.id) { it.copy(liked = r.on, stats = it.stats.copy(likes = r.count)) }
  }

  fun toggleSave(l: Listing) = authed {
    val r = api.save(l.id)
    replace(l.id) { it.copy(saved = r.on, stats = it.stats.copy(saves = r.count)) }
    _messages.tryEmit(if (r.on) "Saved to your garage" else "Removed from saved")
  }

  fun follow(l: Listing) = authed {
    val d = api.follow(l.dealer.handle)
    _state.update { s -> s.copy(items = s.items.map { if (it.dealer.id == d.id) it.copy(dealer = d) else it }) }
  }

  fun recordShare(l: Listing) {
    viewModelScope.launch { runCatching { api.share(l.id) }.onSuccess { c -> replace(l.id) { it.copy(stats = it.stats.copy(shares = c.count)) } } }
  }

  fun shareUrl(l: Listing) = "${api.baseUrl}/listing/${l.id}"

  fun signIn(handle: String) {
    viewModelScope.launch {
      try {
        val r = api.login(handle)
        prefs.edit().putString(KEY_TOKEN, r.token).apply()
        _user.value = r.user
        signInRequested.value = false
        _messages.tryEmit("Signed in as @${r.user.handle}")
        reload()
      } catch (e: Exception) { _messages.tryEmit(e.message ?: "Sign-in failed") }
    }
  }

  fun signOut() {
    prefs.edit().remove(KEY_TOKEN).apply()
    _user.value = null
  }

  suspend fun demoUsers(): List<CrUser> = runCatching { api.demoUsers() }.getOrDefault(emptyList())

  // ---- detail sheet actions (return results to the sheet) ----

  suspend fun detail(id: String): Listing? = runCatching { api.listing(id) }.onFailure { _messages.tryEmit(it.message ?: "Failed to load") }.getOrNull()

  suspend fun quote(id: String, country: String): ShippingQuote? =
    runCatching { api.shipping(id, country) }.onFailure { _messages.tryEmit(it.message ?: "No quote") }.getOrNull()

  fun placeBid(l: Listing, amount: Long, onDone: (Listing) -> Unit) = authed {
    val updated = api.bid(l.id, amount)
    replace(l.id) { updated }
    _messages.tryEmit("Bid placed: ${usd(amount)}. You're the high bidder.")
    onDone(updated)
  }

  fun reserve(l: Listing, country: String, method: String) = authed {
    val o = api.order(l.id, country, method)
    _messages.tryEmit("Reserved! Pay ${usd(o.depositUSD)} deposit to lock it in (total ${usd(o.totalUSD)}).")
  }

  suspend fun comments(id: String): List<Comment> = runCatching { api.comments(id) }.getOrDefault(emptyList())

  fun postComment(l: Listing, text: String, onDone: (Comment) -> Unit) = authed {
    val c = api.comment(l.id, text)
    replace(l.id) { it.copy(stats = it.stats.copy(comments = it.stats.comments + 1)) }
    onDone(c)
  }

  fun requireSignIn(): Boolean = (_user.value == null).also { if (it) signInRequested.value = true }

  companion object {
    private const val KEY_URL = "server_url"
    private const val KEY_TOKEN = "token"

    fun factory(app: Application) = object : ViewModelProvider.Factory {
      @Suppress("UNCHECKED_CAST")
      override fun <T : ViewModel> create(modelClass: Class<T>): T = CarReelViewModel(app) as T
    }
  }
}

fun usd(n: Long?): String = if (n == null) "—" else "$" + String.format(java.util.Locale.US, "%,d", n)

fun compact(n: Long): String = when {
  n >= 1_000_000 -> String.format(java.util.Locale.US, "%.1fM", n / 1_000_000.0).replace(".0M", "M")
  n >= 1_000 -> String.format(java.util.Locale.US, "%.1fK", n / 1_000.0).replace(".0K", "K")
  else -> n.toString()
}
