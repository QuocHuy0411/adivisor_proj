package com.example.backendspringboot.util;

import java.util.concurrent.ThreadLocalRandom;

public final class IdGenerator {

    private IdGenerator() {
    }

    public static String makeId(String prefix) {
        String stamp = Long.toString(System.currentTimeMillis(), 36).toUpperCase();
        String random = Long.toString(ThreadLocalRandom.current().nextLong(1L << 20), 36)
                .substring(0, 5)
                .toUpperCase();
        return prefix + stamp + random;
    }
}
