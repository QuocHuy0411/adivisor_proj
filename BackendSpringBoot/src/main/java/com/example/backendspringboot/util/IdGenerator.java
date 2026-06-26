package com.example.backendspringboot.util;

import java.util.concurrent.ThreadLocalRandom;

public final class IdGenerator {

    private IdGenerator() {
    }

    public static String makeId(String prefix) {
        String stamp = Long.toString(System.currentTimeMillis(), 36).toUpperCase();
        String random = Long.toString(ThreadLocalRandom.current().nextLong(36L * 36 * 36 * 36 * 36), 36)
                .toUpperCase();
        if (random.length() < 5) {
            random = "0".repeat(5 - random.length()) + random;
        }
        return prefix + stamp + random;
    }
}
