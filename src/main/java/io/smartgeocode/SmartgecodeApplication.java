package io.smartgecode;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"io.smartgecode", "com.smartgecode"})  // Scans both for controllers
public class SmartgecodeApplication {
    public static void main(String[] args) {
        SpringApplication.run(SmartgecodeApplication.class, args);
    }
}