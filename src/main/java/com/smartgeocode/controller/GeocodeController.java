package com.smartgecode.controller;

import org.springframework.web.bind.annotation.*;
import java.net.http.*;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "*"}) // Class-level: Allows 3000 + all for prod
public class GeocodeController {
  private final HttpClient client = HttpClient.newHttpClient();
  private final ObjectMapper mapper = new ObjectMapper();

  @GetMapping("/geocode")
  public Map<String, Object> geocode(@RequestParam String addr) throws Exception {
    System.out.println("=== GEOCODE HIT: addr = " + addr + " at " + new java.util.Date()); // Custom log: Hit entry
    String url = "https://nominatim.openstreetmap.org/search?format=json&q=" + addr.replace(" ", "+") + "&limit=1";
    System.out.println("=== GEOCODE URL: " + url); // Custom log: Nominatim URL
    var request = HttpRequest.newBuilder().uri(URI.create(url)).header("User-Agent", "SmartGeocodeMVP/1.0").build();
    var response = client.send(request, HttpResponse.BodyHandlers.ofString());
    System.out.println("=== GEOCODE RESPONSE STATUS: " + response.statusCode()); // Custom log: HTTP status
    if (response.statusCode() == 200) {
      System.out.println("=== GEOCODE RESPONSE BODY: " + response.body()); // Custom log: Raw JSON
      var results = mapper.readValue(response.body(), Map[].class);
      System.out.println("=== GEOCODE PARSED RESULTS LENGTH: " + results.length); // Custom log: Parse success
      if (results.length > 0) {
        var place = results[0];
        var result = Map.of("lat", place.get("lat"), "lng", place.get("lon"), "display_name", place.get("display_name"));
        System.out.println("=== GEOCODE SUCCESS: " + result); // Custom log: Returned coords
        return result;
      }
    }
    System.out.println("=== GEOCODE FAIL: No results for " + addr); // Custom log: Fail reason
    throw new RuntimeException("Geocode failed for " + addr);
  }
}