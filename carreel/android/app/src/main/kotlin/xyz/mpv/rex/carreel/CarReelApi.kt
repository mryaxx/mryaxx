package xyz.mpv.rex.carreel

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

// ---- Models: mirror the CarReel server's JSON (carreel/server/src/app.js) ----

@Serializable
data class Media(val type: String, val url: String, val poster: String? = null) {
  val isVideo get() = type == "video"
}

@Serializable
data class Stats(val likes: Long = 0, val comments: Long = 0, val saves: Long = 0, val shares: Long = 0, val views: Long = 0)

@Serializable
data class CrUser(
  val id: String,
  val handle: String,
  val name: String,
  val type: String = "buyer",
  val verified: Boolean = false,
  val city: String? = null,
  val country: String? = null,
  val bio: String? = null,
  val followers: Long = 0,
  val following: Long = 0,
  val listings: Long = 0,
  val isFollowing: Boolean = false,
) {
  val isDealer get() = type == "dealer"
}

@Serializable
data class LotRef(val id: String, val number: String, val title: String, val endsAt: Long, val ended: Boolean = false)

@Serializable
data class Auction(val currentBidUSD: Long? = null, val bidCount: Int = 0, val minNextBidUSD: Long? = null, val leading: Boolean = false)

@Serializable
data class Listing(
  val id: String,
  val category: String,
  val condition: String,
  val brand: String? = null,
  val model: String? = null,
  val year: Int? = null,
  val title: String,
  val description: String = "",
  val sale: String = "buy_now",
  val priceUSD: Long,
  val startingBidUSD: Long? = null,
  val mileageKm: Long? = null,
  val location: String = "",
  val vin: String? = null,
  val specs: JsonObject? = null,
  val media: List<Media> = emptyList(),
  val stats: Stats = Stats(),
  val dealer: CrUser,
  val lot: LotRef? = null,
  val auction: Auction? = null,
  val liked: Boolean = false,
  val saved: Boolean = false,
) {
  val isAuction get() = sale == "auction"
  val leadMedia get() = media.firstOrNull()
}

@Serializable
data class Page(val items: List<Listing>, val nextCursor: String? = null, val total: Int = 0)

@Serializable
data class Category(val slug: String, val name: String, val icon: String = "", val count: Int = 0)

@Serializable
data class Brand(val slug: String, val name: String, val color: String, val count: Int = 0)

@Serializable
data class Meta(val categories: List<Category>, val conditions: List<String> = emptyList(), val brands: List<Brand>, val countries: List<String>)

@Serializable
data class ShipOption(val method: String, val label: String, val costUSD: Long, val days: List<Int>)

@Serializable
data class ShippingQuote(val country: String, val region: String, val options: List<ShipOption>, val notes: List<String> = emptyList())

@Serializable
data class Order(val id: String, val totalUSD: Long, val depositUSD: Long, val status: String)

@Serializable
data class Comment(val id: String, val text: String, val at: Long, val user: CrUser? = null)

@Serializable
data class LoginResult(val token: String, val user: CrUser)

@Serializable
data class Toggle(val on: Boolean, val count: Long)

@Serializable
data class Count(val count: Long)

@Serializable
private data class ApiError(val error: String = "Request failed")

class ApiException(message: String, val status: Int) : Exception(message)

/** Thin client for the CarReel REST API. All calls run on Dispatchers.IO. */
class CarReelApi(baseUrl: String, private val tokenProvider: () -> String?) {
  val baseUrl: String = baseUrl.trimEnd('/')

  private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
  private val jsonType = "application/json".toMediaType()

  /** Media URLs from the server are root-relative ("/sample-media/x.mp4"); make them absolute for mpv and image loading. */
  fun absolute(url: String): String = if (url.startsWith("http://") || url.startsWith("https://")) url else baseUrl + url

  private suspend inline fun <reified T> call(method: String, path: String, body: JsonObject? = null): T = withContext(Dispatchers.IO) {
    val url = (baseUrl + path).toHttpUrlOrNull() ?: throw ApiException("Invalid server URL: $baseUrl", 0)
    val builder = Request.Builder().url(url)
    tokenProvider()?.let { builder.header("Authorization", "Bearer $it") }
    val reqBody = when {
      body != null -> json.encodeToString(JsonObject.serializer(), body).toRequestBody(jsonType)
      method == "POST" -> "{}".toRequestBody(jsonType)
      else -> null
    }
    builder.method(method, reqBody)
    client.newCall(builder.build()).execute().use { res ->
      val text = res.body.string()
      if (!res.isSuccessful) {
        val msg = runCatching { json.decodeFromString<ApiError>(text).error }.getOrDefault("Request failed (${res.code})")
        throw ApiException(msg, res.code)
      }
      json.decodeFromString<T>(text)
    }
  }

  private fun q(vararg pairs: Pair<String, String?>): String =
    pairs.filter { !it.second.isNullOrEmpty() }
      .joinToString("&", prefix = "?") { "${it.first}=${java.net.URLEncoder.encode(it.second, "UTF-8")}" }

  suspend fun meta(): Meta = call("GET", "/api/meta")
  suspend fun feed(tab: String, category: String?, cursor: String?): Page =
    call("GET", "/api/feed" + q("tab" to tab, "category" to category, "cursor" to cursor))
  suspend fun listing(id: String): Listing = call("GET", "/api/listings/$id")
  suspend fun demoUsers(): List<CrUser> = call("GET", "/api/auth/demo-users")
  suspend fun login(handle: String): LoginResult =
    call("POST", "/api/auth/login", buildJsonObject { put("handle", JsonPrimitive(handle)) })
  suspend fun me(): CrUser = call("GET", "/api/me")
  suspend fun like(id: String): Toggle = call("POST", "/api/listings/$id/like")
  suspend fun save(id: String): Toggle = call("POST", "/api/listings/$id/save")
  suspend fun share(id: String): Count = call("POST", "/api/listings/$id/share")
  suspend fun follow(handle: String): CrUser = call("POST", "/api/users/$handle/follow")
  suspend fun comments(id: String): List<Comment> = call("GET", "/api/listings/$id/comments")
  suspend fun comment(id: String, text: String): Comment =
    call("POST", "/api/listings/$id/comments", buildJsonObject { put("text", JsonPrimitive(text)) })
  suspend fun bid(id: String, amountUSD: Long): Listing =
    call("POST", "/api/listings/$id/bids", buildJsonObject { put("amountUSD", JsonPrimitive(amountUSD)) })
  suspend fun shipping(id: String, country: String): ShippingQuote =
    call("GET", "/api/listings/$id/shipping" + q("country" to country))
  suspend fun order(id: String, country: String, method: String): Order =
    call("POST", "/api/orders", buildJsonObject {
      put("listingId", JsonPrimitive(id)); put("country", JsonPrimitive(country)); put("method", JsonPrimitive(method))
    })

  /** Raw bytes for an uploaded image (jpg/png/webp). */
  suspend fun bytes(url: String): ByteArray? = withContext(Dispatchers.IO) {
    runCatching {
      client.newCall(Request.Builder().url(absolute(url)).build()).execute().use { if (it.isSuccessful) it.body.bytes() else null }
    }.getOrNull()
  }

  companion object {
    /** Android emulator alias for the host machine's localhost, where `npm run dev` serves the API. */
    const val DEFAULT_URL = "http://10.0.2.2:4000"

    private val client = OkHttpClient.Builder()
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(20, TimeUnit.SECONDS)
      .build()
  }
}
