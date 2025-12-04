package io.smartgeocode;  // smartgeocode with 'o'

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"io.smartgeocode", "com.smartgeocode"})  // Scans io.smartgeocode main + com.smartgeocode controller
public class SmartgeocodeApplication {  // SmartgeocodeApplication with 'o' in geocode
    public static void main(String[] args) {
        SpringApplication.run(SmartgeocodeApplication.class, args);  // Full 'Spring' + class ref with 'o' in geocode
    }
}