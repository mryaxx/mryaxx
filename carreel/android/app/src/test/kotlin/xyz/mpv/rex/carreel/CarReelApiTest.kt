package xyz.mpv.rex.carreel

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.net.InetSocketAddress
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Contract test: serves JSON captured from the real CarReel server (src/test/resources/carreel)
 * and checks CarReelApi builds the right requests and decodes every response shape.
 */
class CarReelApiTest {
  private lateinit var server: HttpServer
  private lateinit var api: CarReelApi
  private val requests = CopyOnWriteArrayList<Triple<String, String, String?>>() // method, path+query, auth
  private var token: String? = null

  private fun fixture(name: String) = javaClass.getResource("/carreel/$name")!!.readBytes()

  @Before
  fun setUp() {
    server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    server.createContext("/") { ex ->
      val path = ex.requestURI.path
      val query = ex.requestURI.rawQuery
      requests += Triple(ex.requestMethod, path + (query?.let { "?$it" } ?: ""), ex.requestHeaders.getFirst("Authorization"))
      val (status, body) = when {
        path == "/api/meta" -> 200 to fixture("meta.json")
        path == "/api/feed" && query?.contains("tab=auctions") == true -> 200 to fixture("auctions.json")
        path == "/api/feed" -> 200 to fixture("feed.json")
        path == "/api/auth/login" -> 200 to fixture("login.json")
        path.endsWith("/shipping") -> 200 to fixture("shipping.json")
        path.endsWith("/bids") -> 400 to fixture("bid-error.json")
        path == "/api/listings/l_1" -> 200 to fixture("listing.json")
        else -> 404 to """{"error":"Not found"}""".toByteArray()
      }
      ex.responseHeaders.add("Content-Type", "application/json")
      ex.sendResponseHeaders(status, body.size.toLong())
      ex.responseBody.use { it.write(body) }
    }
    server.start()
    api = CarReelApi("http://127.0.0.1:${server.address.port}/") { token }
  }

  @After
  fun tearDown() = server.stop(0)

  @Test
  fun `decodes meta with categories, brands and countries`() = runBlocking {
    val meta = api.meta()
    assertTrue(meta.categories.any { it.slug == "robotics" })
    assertTrue(meta.brands.any { it.slug == "byd" && it.color.startsWith("#") })
    assertTrue("NG" in meta.countries)
  }

  @Test
  fun `decodes feed page with video and image media and builds the query`() = runBlocking {
    val page = api.feed("foryou", "cars", "6")
    assertEquals(6, page.items.size)
    assertNotNull(page.nextCursor)
    assertTrue(page.items.any { it.leadMedia?.isVideo == true })
    assertTrue(page.items.any { it.leadMedia?.isVideo == false })
    page.items.forEach { assertTrue(it.dealer.handle.isNotEmpty()) }
    assertEquals("/api/feed?tab=foryou&category=cars&cursor=6", requests.last().second)
  }

  @Test
  fun `decodes auction listing with null current bid`() = runBlocking {
    val l = api.listing("l_1")
    assertTrue(l.isAuction)
    assertNull(l.auction!!.currentBidUSD)
    assertEquals(29400L, l.auction!!.minNextBidUSD)
    assertFalse(l.lot!!.ended)
    assertTrue(l.lot!!.endsAt > 1_700_000_000_000)
    assertNotNull(l.specs?.get("batteryKWh"))
  }

  @Test
  fun `auction feed only contains auction items`() = runBlocking {
    val page = api.feed("auctions", null, null)
    assertTrue(page.items.isNotEmpty())
    assertTrue(page.items.all { it.isAuction && it.lot != null })
    assertEquals("/api/feed?tab=auctions", requests.last().second)
  }

  @Test
  fun `login posts handle and later calls send the bearer token`() = runBlocking {
    val r = api.login("amina_lagos")
    assertEquals("amina_lagos", r.user.handle)
    assertEquals("POST", requests.last().first)
    token = r.token
    api.shipping("l_1", "NG")
    assertEquals("Bearer ${r.token}", requests.last().third)
    assertEquals("/api/listings/l_1/shipping?country=NG", requests.last().second)
  }

  @Test
  fun `decodes shipping quote`() = runBlocking {
    val q = api.shipping("l_1", "NG")
    assertEquals("West Africa", q.region)
    assertEquals(listOf("roro", "container"), q.options.map { it.method })
    assertEquals(2, q.options.first().days.size)
  }

  @Test
  fun `server error message is surfaced`() = runBlocking {
    try {
      api.bid("l_1", 1)
      fail("expected ApiException")
    } catch (e: ApiException) {
      assertEquals(400, e.status)
      assertEquals("Minimum bid is \$29,400", e.message)
    }
  }

  @Test
  fun `relative media urls are made absolute`() {
    assertEquals("${api.baseUrl}/sample-media/byd.mp4", api.absolute("/sample-media/byd.mp4"))
    assertEquals("https://cdn.example.com/a.m3u8", api.absolute("https://cdn.example.com/a.m3u8"))
  }

  @Test
  fun `number formatting`() {
    assertEquals("$29,400", usd(29400))
    assertEquals("—", usd(null))
    assertEquals("10.1K", compact(10_100))
    assertEquals("2K", compact(2_000))
    assertEquals("1.5M", compact(1_500_000))
    assertEquals("999", compact(999))
  }
}
