package xyz.mpv.rex.carreel

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.graphics.BitmapFactory
import android.view.WindowManager
import android.widget.Toast
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.ElectricBolt
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Build
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import `is`.xyz.mpv.MPVLib
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.serialization.json.JsonPrimitive
import org.koin.compose.koinInject
import xyz.mpv.rex.ui.browser.miniplayer.MiniPlayerStateManager
import xyz.mpv.rex.ui.browser.shorts.ShortsPlayerHost
import xyz.mpv.rex.ui.player.HeadlessPlaybackController
import xyz.mpv.rex.ui.player.MPVView
import xyz.mpv.rex.ui.player.PlayerActivity

private val Accent = Color(0xFFFF2D55)
private val Cyan = Color(0xFF25F4EE)
private val Sheet = Color(0xFF121214)
private val Surface2 = Color(0xFF1C1C20)
private val Muted = Color(0xFF9A9AA3)

private val CATEGORY_COLORS = mapOf("parts" to 0xFF475569, "robotics" to 0xFF0E7490, "automotive-tech" to 0xFF15803D)
private val CONDITION_LABEL = mapOf("new" to "Brand new", "refurbished" to "Refurbished", "used" to "Used")
private val CONDITION_COLOR = mapOf("new" to Color(0xFF34C759), "refurbished" to Cyan, "used" to Color(0xFFFF9F0A))

/**
 * CarReel's TikTok-style marketplace feed, built on REX Player's Shorts engine:
 * one shared libmpv surface (ShortsPlayerHost) sits behind a VerticalPager, slides with the
 * scroll, and `loadfile`s the clip of whichever page settles, exactly like REX's Shorts tab.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun CarReelScreen() {
  val context = LocalContext.current
  val vm: CarReelViewModel = viewModel(factory = CarReelViewModel.factory(context.applicationContext as android.app.Application))
  val state by vm.state.collectAsState()
  val meta by vm.meta.collectAsState()
  val user by vm.user.collectAsState()
  val signIn by vm.signInRequested.collectAsState()
  val miniPlayerStateManager = koinInject<MiniPlayerStateManager>()
  val headlessPlaybackController = koinInject<HeadlessPlaybackController>()

  var detailFor by remember { mutableStateOf<Listing?>(null) }
  var commentsFor by remember { mutableStateOf<Listing?>(null) }
  var muted by remember { mutableStateOf(false) }

  LaunchedEffect(Unit) {
    // Only one libmpv session may exist: stop REX's background/mini player before we take it over.
    if (headlessPlaybackController.isSessionActive || headlessPlaybackController.ownsNativeSession) headlessPlaybackController.stop()
    miniPlayerStateManager.clearState()
    PlayerActivity.finishBackgroundInstance()
  }
  LaunchedEffect(Unit) { vm.messages.collect { Toast.makeText(context, it, Toast.LENGTH_SHORT).show() } }

  Box(Modifier.fillMaxSize().background(Color.Black)) {
    val items = state.items
    if (items.isEmpty()) {
      EmptyState(state, user, onRetry = vm::reload, onSettings = { vm.signInRequested.value = true })
    } else {
      val pagerState = rememberPagerState(pageCount = { state.items.size }) // reads live state, so appended pages appear
      LaunchedEffect(state.generation) { if (pagerState.currentPage != 0) pagerState.scrollToPage(0) }
      LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.settledPage }.distinctUntilChanged().collect { if (it >= vm.state.value.items.size - 3) vm.loadMore() }
      }

      var mpvView by remember { mutableStateOf<MPVView?>(null) }
      var isPlayerReady by remember { mutableStateOf(false) }
      var playingPage by remember { mutableIntStateOf(-1) }
      var manuallyPaused by remember { mutableStateOf(false) }
      val settled = items.getOrNull(pagerState.settledPage)
      val settledVideo = settled?.leadMedia?.takeIf { it.isVideo }

      BoxWithConstraints(Modifier.fillMaxSize()) {
        val heightPx = with(LocalDensity.current) { maxHeight.toPx() }

        // The single mpv surface, translated so it scrolls with the page that is playing.
        Box(
          Modifier.fillMaxSize().graphicsLayer {
            val scroll = (pagerState.currentPage + pagerState.currentPageOffsetFraction) * heightPx
            translationY = -scroll + playingPage * heightPx
            alpha = if (isPlayerReady && settledVideo != null && playingPage >= 0) 1f else 0f
          },
        ) {
          ShortsPlayerHost(
            modifier = Modifier.fillMaxSize(),
            onReady = { mpvView = it },
            onPlayerReadyChange = { ready ->
              isPlayerReady = ready
              if (ready) playingPage = pagerState.settledPage
            },
          )
        }

        LaunchedEffect(pagerState.settledPage, mpvView, settled?.id) {
          if (mpvView == null) return@LaunchedEffect
          manuallyPaused = false
          if (settledVideo != null) {
            MPVLib.command("loadfile", vm.api.absolute(settledVideo.url))
            MPVLib.setPropertyString("loop-file", "inf")
            MPVLib.setPropertyBoolean("mute", muted)
            MPVLib.setPropertyBoolean("pause", false)
          } else {
            isPlayerReady = false
            MPVLib.command("stop")
          }
        }
        LaunchedEffect(muted, mpvView) { if (mpvView != null) MPVLib.setPropertyBoolean("mute", muted) }

        PlaybackLifecycle(isVideo = settledVideo != null, paused = manuallyPaused, keepAwake = settledVideo != null && !manuallyPaused)

        VerticalPager(state = pagerState, modifier = Modifier.fillMaxSize(), beyondViewportPageCount = 1, key = { items[it].id }) { page ->
          val l = items[page]
          val showingVideo = l.leadMedia?.isVideo == true && isPlayerReady && playingPage == page && pagerState.settledPage == page
          ReelPage(
            l = l,
            vm = vm,
            showingVideo = showingVideo,
            muted = muted,
            meta = meta,
            ownListing = user?.id == l.dealer.id,
            onToggleMute = { muted = !muted },
            onTap = {
              if (l.leadMedia?.isVideo == true && pagerState.settledPage == page) {
                manuallyPaused = !manuallyPaused
                MPVLib.setPropertyBoolean("pause", manuallyPaused)
              }
            },
            onComments = { commentsFor = l },
            onDetail = { detailFor = l },
            onShare = {
              val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                .putExtra(Intent.EXTRA_SUBJECT, l.title)
                .putExtra(Intent.EXTRA_TEXT, "${l.title} · ${usd(l.priceUSD)}\n${vm.shareUrl(l)}")
              context.startActivity(Intent.createChooser(send, "Share listing"))
              vm.recordShare(l)
            },
          )
        }
      }
    }

    FeedHeader(state, meta, onTab = vm::selectTab, onCategory = vm::selectCategory, onSettings = { vm.signInRequested.value = true })
  }

  detailFor?.let { l -> DetailSheet(l, vm, meta, onDismiss = { detailFor = null }) }
  commentsFor?.let { l -> CommentsSheet(l, vm, onDismiss = { commentsFor = null }) }
  if (signIn) SignInSheet(vm, user, onDismiss = { vm.signInRequested.value = false })
}

/** Pause with the app/lifecycle, and keep the screen on while a clip plays. */
@Composable
private fun PlaybackLifecycle(isVideo: Boolean, paused: Boolean, keepAwake: Boolean) {
  val owner = LocalLifecycleOwner.current
  val view = LocalView.current
  DisposableEffect(owner, isVideo, paused) {
    val obs = LifecycleEventObserver { _, e ->
      when (e) {
        Lifecycle.Event.ON_PAUSE -> MPVLib.setPropertyBoolean("pause", true)
        Lifecycle.Event.ON_RESUME -> if (isVideo && !paused) MPVLib.setPropertyBoolean("pause", false)
        else -> {}
      }
    }
    owner.lifecycle.addObserver(obs)
    onDispose { owner.lifecycle.removeObserver(obs) }
  }
  DisposableEffect(keepAwake) {
    val window = view.context.findActivity()?.window
    if (keepAwake) window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    onDispose { window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
  }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
  is Activity -> this
  is ContextWrapper -> baseContext.findActivity()
  else -> null
}

@Composable
private fun FeedHeader(state: FeedState, meta: Meta?, onTab: (FeedTab) -> Unit, onCategory: (String?) -> Unit, onSettings: () -> Unit) {
  Column(
    Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color(0xAA000000), Color.Transparent))).statusBarsPadding().padding(top = 6.dp),
  ) {
    Box(Modifier.fillMaxWidth()) {
      Row(Modifier.align(Alignment.Center), horizontalArrangement = Arrangement.spacedBy(18.dp)) {
        FeedTab.entries.forEach { t ->
          val on = t == state.tab
          Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onTab(t) }) {
            Text(t.label, color = if (on) Color.White else Color(0xBBFFFFFF), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Box(Modifier.padding(top = 3.dp).height(2.dp).width(24.dp).background(if (on) Color.White else Color.Transparent))
          }
        }
      }
      IconButton(onClick = onSettings, modifier = Modifier.align(Alignment.CenterEnd)) {
        Icon(Icons.Filled.Settings, contentDescription = "Account & server", tint = Color.White)
      }
    }
    LazyRow(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      item { Pill("All", state.category == null) { onCategory(null) } }
      items(meta?.categories.orEmpty(), key = { it.slug }) { c -> Pill("${c.icon} ${c.name}", state.category == c.slug) { onCategory(c.slug) } }
    }
  }
}

@Composable
private fun Pill(text: String, on: Boolean, onClick: () -> Unit) {
  Text(
    text,
    color = if (on) Color.Black else Color.White,
    fontSize = 13.sp,
    modifier = Modifier.clip(RoundedCornerShape(50)).background(if (on) Color.White else Color(0x66000000))
      .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(50)).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 6.dp),
  )
}

@Composable
private fun EmptyState(state: FeedState, user: CrUser?, onRetry: () -> Unit, onSettings: () -> Unit) {
  Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
    when {
      state.loading -> CircularProgressIndicator(color = Accent)
      state.error != null -> {
        Text("Can't load the feed", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = Accent)) { Text("Retry") }
          OutlinedButton(onClick = onSettings) { Text("Server settings", color = Color.White) }
        }
      }
      state.tab == FeedTab.FOLLOWING ->
        Text(if (user == null) "Sign in and follow dealers to build your Following feed." else "Follow dealers to see their new drops here.", color = Muted, textAlign = TextAlign.Center)
      else -> Text("No listings match this filter.", color = Muted)
    }
  }
}

// ---------- one reel ----------

@Composable
private fun ReelPage(
  l: Listing, vm: CarReelViewModel, showingVideo: Boolean, muted: Boolean, meta: Meta?, ownListing: Boolean,
  onToggleMute: () -> Unit, onTap: () -> Unit, onComments: () -> Unit, onDetail: () -> Unit, onShare: () -> Unit,
) {
  var burst by remember { mutableIntStateOf(0) }
  Box(
    Modifier.fillMaxSize().pointerInput(l.id) {
      detectTapGestures(onTap = { onTap() }, onDoubleTap = { burst++; vm.toggleLike(l, onlyLike = true) })
    },
  ) {
    // Poster / photo. Hidden once the mpv clip for this page is on screen behind it.
    if (!showingVideo) ListingArt(l, vm, meta, Modifier.fillMaxSize())

    if (burst > 0) HeartBurst(burst)
    Box(Modifier.fillMaxWidth().fillMaxHeight(0.55f).align(Alignment.BottomCenter).background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xDD000000)))))

    if (l.leadMedia?.isVideo == true) {
      IconButton(onClick = onToggleMute, modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = 92.dp, end = 8.dp).clip(CircleShape).background(Color(0x66000000))) {
        Icon(if (muted) Icons.Filled.VolumeOff else Icons.Filled.VolumeUp, contentDescription = if (muted) "Unmute" else "Mute", tint = Color.White)
      }
    }

    // Right action rail
    Column(
      Modifier.align(Alignment.BottomEnd).padding(end = 8.dp, bottom = 96.dp),
      horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      Box(Modifier.padding(bottom = 8.dp)) {
        Initials(l.dealer, 48)
        if (!ownListing && !l.dealer.isFollowing) {
          Text("+", color = Color.White, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center,
            modifier = Modifier.align(Alignment.BottomCenter).offset(y = 9.dp).size(20.dp).clip(CircleShape).background(Accent).clickable { vm.follow(l) })
        }
      }
      RailButton(if (l.liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, compact(l.stats.likes), if (l.liked) Accent else Color.White, "Like") { vm.toggleLike(l) }
      RailButton(Icons.Filled.ChatBubble, compact(l.stats.comments), Color.White, "Comments", onComments)
      RailButton(if (l.saved) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder, compact(l.stats.saves), if (l.saved) Color(0xFFFFD60A) else Color.White, "Save") { vm.toggleSave(l) }
      RailButton(Icons.Filled.Share, compact(l.stats.shares), Color.White, "Share", onShare)
    }

    // Caption
    Column(Modifier.align(Alignment.BottomStart).padding(start = 12.dp, end = 76.dp, bottom = 76.dp)) {
      Text("@${l.dealer.handle}" + if (l.dealer.verified) "  ✔" else "", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
      Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Chip(CONDITION_LABEL[l.condition] ?: l.condition, CONDITION_COLOR[l.condition] ?: Color.Gray, Color.Black)
        l.lot?.let { Chip("Lot ${it.number}", Color(0xAA000000), Color.White) }
        if (l.isAuction && l.lot != null) Countdown(l.lot.endsAt) { text, urgent -> Chip("⏱ $text", if (urgent) Accent else Color(0xAA000000), Color.White) }
      }
      Text(l.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp, modifier = Modifier.padding(top = 6.dp).clickable(onClick = onDetail))
      Text("📍 ${l.location}", color = Color(0xDDFFFFFF), fontSize = 13.sp)
      Text(l.description, color = Color(0xD0FFFFFF), fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }

    // Price CTA
    Row(
      Modifier.align(Alignment.BottomCenter).padding(12.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp))
        .background(Color(0xEBFFFFFF)).clickable(onClick = onDetail).padding(horizontal = 14.dp, vertical = 10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      val a = l.auction
      Text(
        if (l.isAuction) (if (a?.currentBidUSD != null) "Current bid" else "Starting bid") else "Buy now · FOB China",
        color = Color(0xFF555555), fontSize = 11.sp, modifier = Modifier.weight(1f),
      )
      Text(if (l.isAuction) usd(a?.currentBidUSD ?: a?.minNextBidUSD) else usd(l.priceUSD), color = Color.Black, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
      Text(if (l.isAuction) "Bid ›" else "Buy ›", color = Color.White, fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = 10.dp).clip(RoundedCornerShape(8.dp)).background(Accent).padding(horizontal = 12.dp, vertical = 6.dp))
    }
  }
}

@Composable
private fun HeartBurst(key: Int) {
  var target by remember(key) { mutableStateOf(0f) }
  LaunchedEffect(key) { target = 1f }
  val p by animateFloatAsState(target, tween(800), label = "burst")
  if (p < 1f) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
      Icon(Icons.Filled.Favorite, null, tint = Accent,
        modifier = Modifier.size(110.dp).scale(0.4f + p * 0.8f).graphicsLayer { alpha = 1f - p; translationY = -p * 120f })
    }
  }
}

@Composable
private fun RailButton(icon: ImageVector, label: String, tint: Color, desc: String, onClick: () -> Unit) {
  Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable(onClick = onClick)) {
    Icon(icon, contentDescription = desc, tint = tint, modifier = Modifier.size(34.dp))
    Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
  }
}

@Composable
private fun Chip(text: String, bg: Color, fg: Color) {
  Text(text, color = fg, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1,
    modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(bg).padding(horizontal = 8.dp, vertical = 3.dp))
}

@Composable
private fun Initials(u: CrUser, size: Int) {
  val palette = listOf(0xFFFF2D55, 0xFF5856D6, 0xFF34C759, 0xFFFF9500, 0xFF0A84FF, 0xFFAF52DE, 0xFF00C7BE)
  val color = Color(palette[u.handle.sumOf { it.code } % palette.size])
  val initials = u.name.split(" ").mapNotNull { it.firstOrNull()?.uppercaseChar() }.take(2).joinToString("")
  Box(Modifier.size(size.dp).clip(CircleShape).background(color).border(2.dp, Color.White, CircleShape), contentAlignment = Alignment.Center) {
    Text(initials, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = (size * 0.36).sp)
  }
}

@Composable
private fun Countdown(endsAt: Long, content: @Composable (String, Boolean) -> Unit) {
  var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
  LaunchedEffect(endsAt) { while (true) { now = System.currentTimeMillis(); delay(1000) } }
  val ms = (endsAt - now).coerceAtLeast(0)
  val d = ms / 86_400_000; val h = ms / 3_600_000 % 24; val m = ms / 60_000 % 60; val s = ms / 1000 % 60
  val text = when { ms == 0L -> "Ended"; d > 0 -> "${d}d ${h}h ${m}m"; else -> String.format(java.util.Locale.US, "%02d:%02d:%02d", h, m, s) }
  content(text, ms in 1 until 3_600_000)
}

/**
 * Listing artwork. Uploaded photos are fetched and decoded; the server's generated SVG posters are
 * drawn natively (Android can't decode SVG) using the brand colour, which keeps the feed instant.
 */
@Composable
private fun ListingArt(l: Listing, vm: CarReelViewModel, meta: Meta?, modifier: Modifier) {
  val photo = l.media.firstOrNull { !it.isVideo && !it.url.endsWith(".svg") }
  val bitmap by produceState<android.graphics.Bitmap?>(null, photo?.url) {
    value = photo?.let { m -> vm.api.bytes(m.url)?.let { BitmapFactory.decodeByteArray(it, 0, it.size) } }
  }
  val bm = bitmap
  if (bm != null) {
    Image(bm.asImageBitmap(), contentDescription = l.title, contentScale = ContentScale.Crop, modifier = modifier)
    return
  }
  val brand = meta?.brands?.firstOrNull { it.slug == l.brand }
  val base = if (l.category == "cars") parseColor(brand?.color) ?: Color(0xFF334155) else Color(CATEGORY_COLORS[l.category] ?: 0xFF334155)
  val label = if (l.category == "cars") brand?.name ?: "" else l.category.replace('-', ' ').uppercase()
  val icon = when (l.category) { "parts" -> Icons.Filled.Build; "robotics" -> Icons.Filled.SmartToy; "automotive-tech" -> Icons.Filled.ElectricBolt; else -> Icons.Filled.DirectionsCar }
  Box(modifier.background(Brush.linearGradient(listOf(base, Color(0xFF0B0B0F)))), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.offset(y = (-60).dp)) {
      Text(label, color = Color(0x33FFFFFF), fontWeight = FontWeight.ExtraBold, fontSize = 40.sp, letterSpacing = 4.sp)
      Icon(icon, contentDescription = null, tint = Color(0xEEFFFFFF), modifier = Modifier.size(180.dp))
    }
  }
}

private fun parseColor(hex: String?): Color? = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrNull()

// ---------- sheets ----------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailSheet(initial: Listing, vm: CarReelViewModel, meta: Meta?, onDismiss: () -> Unit) {
  var l by remember { mutableStateOf(initial) }
  LaunchedEffect(initial.id) { vm.detail(initial.id)?.let { l = it } }
  val user by vm.user.collectAsState()
  var country by remember { mutableStateOf(user?.country?.takeIf { meta?.countries?.contains(it) == true }) }
  var quote by remember { mutableStateOf<ShippingQuote?>(null) }
  var method by remember { mutableStateOf<String?>(null) }
  LaunchedEffect(country) {
    quote = null
    country?.let { c -> vm.quote(l.id, c)?.let { quote = it; method = it.options.firstOrNull()?.method } }
  }

  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Sheet) {
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      item {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Chip(CONDITION_LABEL[l.condition] ?: l.condition, CONDITION_COLOR[l.condition] ?: Color.Gray, Color.Black)
          l.lot?.let { Chip("Lot ${it.number}", Surface2, Color.White) }
          l.brand?.let { Chip(it.uppercase(), Surface2, Color.White) }
        }
        Text(l.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 22.sp, modifier = Modifier.padding(top = 8.dp))
        Text(
          listOfNotNull("📍 ${l.location}", l.mileageKm?.let { String.format(java.util.Locale.US, "%,d km", it) }, l.vin?.let { "VIN $it" }).joinToString(" · "),
          color = Muted, fontSize = 13.sp,
        )
      }

      if (l.isAuction) item { AuctionBox(l, ownListing = user?.id == l.dealer.id, vm) { l = it } }

      item {
        Panel {
          if (!l.isAuction) Text("${usd(l.priceUSD)}  FOB China", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp)
          Text("Ship to", color = Muted, fontSize = 13.sp)
          LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(meta?.countries.orEmpty()) { c ->
              FilterChip(selected = c == country, onClick = { country = c }, label = { Text(c) },
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Accent, labelColor = Color.White, selectedLabelColor = Color.White))
            }
          }
          quote?.let { q ->
            q.options.forEach { o ->
              Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).border(1.dp, if (o.method == method) Accent else Color(0xFF2A2A30), RoundedCornerShape(10.dp))
                  .clickable { method = o.method }.padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
              ) {
                RadioButton(selected = o.method == method, onClick = { method = o.method })
                Column(Modifier.weight(1f)) {
                  Text(o.label, color = Color.White, fontWeight = FontWeight.SemiBold)
                  Text("${o.days.first()}–${o.days.last()} days to ${q.region}", color = Muted, fontSize = 12.sp)
                }
                Text(usd(o.costUSD), color = Color.White, fontWeight = FontWeight.Bold)
              }
            }
            val opt = q.options.firstOrNull { it.method == method }
            if (!l.isAuction && opt != null) {
              Row(Modifier.fillMaxWidth()) {
                Text("Estimated total (excl. duties)", color = Muted, modifier = Modifier.weight(1f))
                Text(usd(l.priceUSD + opt.costUSD), color = Color.White, fontWeight = FontWeight.Bold)
              }
            }
            q.notes.forEach { Text("• $it", color = Muted, fontSize = 12.sp) }
            if (!l.isAuction && opt != null && user?.id != l.dealer.id) {
              Button(onClick = { vm.reserve(l, q.country, opt.method) }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Accent)) {
                Text("Reserve with 10% deposit (${usd((l.priceUSD + opt.costUSD) / 10)})")
              }
            }
          } ?: Text(if (country == null) "Choose a destination for a freight estimate." else "Getting quote…", color = Muted, fontSize = 13.sp)
        }
      }

      item {
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Surface2).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
          Initials(l.dealer, 44)
          Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Text(l.dealer.name + if (l.dealer.verified) "  ✔" else "", color = Color.White, fontWeight = FontWeight.Bold)
            Text("@${l.dealer.handle} · ${l.dealer.city ?: ""} · ${compact(l.dealer.followers)} followers", color = Muted, fontSize = 12.sp)
          }
        }
      }
      item { Text(l.description, color = Color.White) }
      val specs = l.specs?.entries?.mapNotNull { (k, v) -> (v as? JsonPrimitive)?.content?.let { SPEC_LABELS[k].orEmpty().ifEmpty { k } to formatSpec(k, it) } }.orEmpty()
      if (specs.isNotEmpty()) {
        item {
          Column(Modifier.clip(RoundedCornerShape(12.dp)).background(Surface2)) {
            specs.chunked(2).forEachIndexed { i, row ->
              if (i > 0) HorizontalDivider(color = Color(0xFF2A2A30))
              Row {
                row.forEach { (k, v) ->
                  Column(Modifier.weight(1f).padding(10.dp)) {
                    Text(k, color = Muted, fontSize = 11.sp)
                    Text(v, color = Color.White, fontWeight = FontWeight.SemiBold)
                  }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun AuctionBox(l: Listing, ownListing: Boolean, vm: CarReelViewModel, onUpdated: (Listing) -> Unit) {
  val a = l.auction ?: return
  val min = a.minNextBidUSD ?: return
  Panel {
    Row(Modifier.fillMaxWidth()) {
      Column(Modifier.weight(1f)) {
        Text(if (a.currentBidUSD != null) "Current bid" else "Starting bid", color = Muted, fontSize = 12.sp)
        Text(usd(a.currentBidUSD ?: l.startingBidUSD), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 26.sp)
        Text("${a.bidCount} bids", color = Muted, fontSize = 12.sp)
      }
      l.lot?.let { lot ->
        Column(horizontalAlignment = Alignment.End) {
          Text("Lot closes in", color = Muted, fontSize = 12.sp)
          Countdown(lot.endsAt) { text, urgent -> Text(text, color = if (urgent) Accent else Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
        }
      }
    }
    if (a.leading) Text("✔ You are the high bidder", color = Color(0xFF34C759))
    when {
      l.lot?.ended == true || (l.lot?.endsAt ?: 0) < System.currentTimeMillis() -> Text("This lot has closed.", color = Muted)
      ownListing -> Text("You're the seller of this item.", color = Muted)
      else -> {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          listOf(0L, 500L, 1000L).forEach { extra ->
            Button(
              onClick = { vm.placeBid(l, min + extra, onUpdated) },
              modifier = Modifier.weight(1f),
              colors = ButtonDefaults.buttonColors(containerColor = if (extra == 0L) Accent else Surface2),
              contentPadding = PaddingValues(4.dp),
            ) { Text("Bid ${usd(min + extra)}", fontSize = 13.sp, maxLines = 1) }
          }
        }
        Text("Bids in the last 2 min extend the lot · Buyer's premium & deposit apply", color = Muted, fontSize = 11.sp)
      }
    }
  }
}

@Composable
private fun Panel(content: @Composable () -> Unit) {
  Column(
    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFF17171A)).border(1.dp, Color(0xFF2A2A30), RoundedCornerShape(14.dp)).padding(14.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) { content() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommentsSheet(l: Listing, vm: CarReelViewModel, onDismiss: () -> Unit) {
  var comments by remember { mutableStateOf<List<Comment>?>(null) }
  var text by remember { mutableStateOf("") }
  LaunchedEffect(l.id) { comments = vm.comments(l.id) }
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Sheet) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
      Text("${comments?.size ?: ""} comments", color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.CenterHorizontally))
      val list = comments
      when {
        list == null -> CircularProgressIndicator(color = Accent, modifier = Modifier.align(Alignment.CenterHorizontally).padding(24.dp))
        list.isEmpty() -> Text("Be the first to ask the dealer something.", color = Muted, modifier = Modifier.padding(vertical = 24.dp).align(Alignment.CenterHorizontally))
        else -> LazyColumn(Modifier.fillMaxWidth().height(320.dp), verticalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(vertical = 12.dp)) {
          items(list, key = { it.id }) { c ->
            Row {
              c.user?.let { Initials(it, 32) }
              Column(Modifier.padding(start = 10.dp)) {
                Text("@${c.user?.handle ?: "user"}", color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Text(c.text, color = Color.White)
              }
            }
          }
        }
      }
      Row(verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(text, { text = it.take(500) }, placeholder = { Text("Ask about shipping, specs, RHD…") }, modifier = Modifier.weight(1f), singleLine = true)
        IconButton(enabled = text.isNotBlank(), onClick = {
          if (vm.requireSignIn()) return@IconButton
          vm.postComment(l, text.trim()) { c -> comments = listOf(c) + comments.orEmpty(); text = "" }
        }) { Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Post", tint = Accent) }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SignInSheet(vm: CarReelViewModel, user: CrUser?, onDismiss: () -> Unit) {
  val serverUrl by vm.serverUrl.collectAsState()
  var url by remember(serverUrl) { mutableStateOf(serverUrl) }
  val users by produceState<List<CrUser>?>(null, serverUrl) { value = vm.demoUsers() }
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Sheet) {
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      item {
        Text("CarReel server", color = Color.White, fontWeight = FontWeight.Bold)
        Row(verticalAlignment = Alignment.CenterVertically) {
          OutlinedTextField(url, { url = it }, singleLine = true, modifier = Modifier.weight(1f))
          TextButton(onClick = { vm.setServerUrl(url) }) { Text("Connect", color = Accent) }
        }
        Text("Emulator: ${CarReelApi.DEFAULT_URL} reaches `npm run dev` on your computer. On a phone, use your computer's LAN IP.", color = Muted, fontSize = 12.sp)
      }
      item {
        HorizontalDivider(color = Color(0xFF2A2A30), modifier = Modifier.padding(vertical = 8.dp))
        if (user != null) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Signed in as @${user.handle}", color = Color.White, modifier = Modifier.weight(1f))
            TextButton(onClick = { vm.signOut() }) { Text("Sign out", color = Accent) }
          }
        } else {
          Text("Sign in with a demo account", color = Color.White, fontWeight = FontWeight.Bold)
          Text("Prototype only: no passwords yet. Dealers can sell; buyers can bid and buy.", color = Muted, fontSize = 12.sp)
        }
      }
      if (user == null) {
        val list = users
        if (list == null) item { CircularProgressIndicator(color = Accent) }
        else if (list.isEmpty()) item { Text("Couldn't reach the server.", color = Muted) }
        else items(list, key = { it.id }) { u ->
          Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { vm.signIn(u.handle) }.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Initials(u, 36)
            Column(Modifier.padding(start = 12.dp)) {
              Text(u.name, color = Color.White, fontWeight = FontWeight.SemiBold)
              Text("@${u.handle} · ${if (u.isDealer) "Dealer" else "Buyer"} · ${u.city ?: ""}", color = Muted, fontSize = 12.sp)
            }
          }
        }
      }
    }
  }
}

private val SPEC_LABELS = mapOf(
  "powertrain" to "Powertrain", "rangeKm" to "Range (CLTC)", "batteryKWh" to "Battery", "drive" to "Drive", "seats" to "Seats",
  "steering" to "Steering", "color" to "Color", "batterySOH" to "Battery health", "fitment" to "Fits", "warrantyMonths" to "Warranty",
  "weightKg" to "Weight", "payloadKg" to "Payload", "runtimeH" to "Runtime", "sdk" to "SDK",
)

private fun formatSpec(key: String, v: String) = when (key) {
  "rangeKm" -> "$v km"; "batteryKWh" -> "$v kWh"; "batterySOH" -> "$v%"; "warrantyMonths" -> "$v months"
  "weightKg", "payloadKg" -> "$v kg"; "runtimeH" -> "$v h"; else -> v
}
