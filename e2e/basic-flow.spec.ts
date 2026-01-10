import { test, expect } from '@playwright/test';

test('basic flow: login and navigate to dashboard', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login');

    // 2. Fill login form
    // Using admin credentials from seed.ts
    await page.fill('input[type="text"]', 'admin'); // Employee ID
    await page.fill('input[type="password"]', 'admin123'); // Password

    // 3. Submit
    await page.click('button[type="submit"]');

    // 4. Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // 5. Verify dashboard content
    await expect(page.locator('h1')).toContainText('Dashboard');
});
