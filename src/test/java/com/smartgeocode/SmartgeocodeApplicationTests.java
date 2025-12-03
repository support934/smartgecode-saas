package com.smartgecode;

import io.smartgecode.SmartgecodeApplication;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(classes = SmartgecodeApplication.class)
class SmartgecodeApplicationTests {

    @Test
    void contextLoads() {
        // Basic smoke test: Ensures Spring context loads without errors
        // Add more assertions here as endpoints/services grow (e.g., @Autowired GeocodeController, mockMvc tests)
    }

}