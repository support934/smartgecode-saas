package io.smartgecode.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")  // Maps all methods under /api/v1
@CrossOrigin(origins = "*")
public class GeocodeController {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/geocode")
    public ResponseEntity<Map<String, Object>> geocode(@RequestParam String address) {
        Map<String, Object> response = new HashMap<>();
        try {
            String nominatimUrl = System.getenv("NOMINATIM_URL") || "https://nominatim.openstreetmap.org";
            String url = nominatimUrl + "/search?q=" + address + "&format=json&limit=1&addressdetails=1";
            String[] results = restTemplate.getForObject(url, String[].class);
            if (results != null && results.length > 0) {
                Map<String, Object> place = objectMapper.readValue(results[0], Map.class);
                response.put("lat", Double.parseDouble(place.get("lat").toString()));
                response.put("lng", Double.parseDouble(place.get("lon").toString()));
                response.put("formatted_address", place.get("display_name"));
                response.put("confidence", 0.95);
                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {
            response.put("error", "Geocoding failed: " + e.getMessage());
        }
        return ResponseEntity.ok(response);
    }
}