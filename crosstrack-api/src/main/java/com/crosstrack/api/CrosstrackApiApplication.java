package com.crosstrack.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CrosstrackApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(CrosstrackApiApplication.class, args);
    }
}
