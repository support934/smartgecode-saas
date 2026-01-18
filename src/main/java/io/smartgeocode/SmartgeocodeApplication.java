package io.smartgeocode;  // smartgeocode with 'o'

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;

@SpringBootApplication(scanBasePackages = {"io.smartgeocode"})  // Scans io.smartgeocode main + com.smartgeocode controller
public class SmartgeocodeApplication {  // SmartgeocodeApplication with 'o' in geocode
    public static void main(String[] args) {
        SpringApplication.run(SmartgeocodeApplication.class, args);  // Full 'Spring' + class ref with 'o' in geocode
    }
@Bean
    CommandLineRunner commandLineRunner(
            @Value("${spring.datasource.url}") String url,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password}") String password
    ) {
        return args -> {
            System.out.println("DEBUG: Resolved datasource URL: " + url);
            System.out.println("DEBUG: Resolved datasource username: " + username);
            System.out.println("DEBUG: Resolved datasource password: " + (password.length() > 3 ? password.substring(0, 3) + "*****" + password.substring(password.length() - 3) : "*****"));
        };
    }
}