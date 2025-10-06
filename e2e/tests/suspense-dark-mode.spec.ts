import { test, expect } from '@playwright/test';

test('dark mode stays consistent during hydration with Suspense', async ({ page }) => {
  // Track console errors - any console.error should fail the test (catches hydration errors)
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Set localStorage before the page loads
  await page.addInitScript(() => {
    localStorage.setItem('darkMode', 'true');
  });

  // Navigate to the page
  await page.goto('/');

  // Get components by test ID
  // 2 EagerComponents with data-testid="eager-component"
  // 1 LazyChild with data-testid="lazy-component"
  const eagerComponents = page.getByTestId('eager-component');
  const eagerComponentFirst = eagerComponents.first();
  const eagerComponentSecond = eagerComponents.nth(1);
  const lazyComponent = page.getByTestId('lazy-component');

  // Wait for all 3 components to be visible (including the lazy-loaded one)
  await expect(eagerComponentFirst).toBeVisible();
  await expect(eagerComponentSecond).toBeVisible();
  await expect(lazyComponent).toBeVisible();

  // All 3 components should start in LIGHT mode to avoid hydration errors
  // Light mode: background-color: rgb(245, 245, 245), color: rgb(0, 0, 0)
  await expect(eagerComponentFirst).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(eagerComponentFirst).toHaveCSS('color', 'rgb(0, 0, 0)');

  await expect(eagerComponentSecond).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(eagerComponentSecond).toHaveCSS('color', 'rgb(0, 0, 0)');

  await expect(lazyComponent).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(lazyComponent).toHaveCSS('color', 'rgb(0, 0, 0)');

  // Wait for the first component to switch to DARK mode
  // This happens when onSubscribe fires after all components have hydrated
  // Dark mode: background-color: rgb(26, 26, 26), color: rgb(255, 255, 255)
  await expect(eagerComponentFirst).toHaveCSS('background-color', 'rgb(26, 26, 26)', {
    timeout: 10000, // Give it time for hydration to complete
  });

  // Once the first component switches, ALL components should be in dark mode (consistent state)
  await expect(eagerComponentFirst).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(eagerComponentSecond).toHaveCSS('background-color', 'rgb(26, 26, 26)');
  await expect(eagerComponentSecond).toHaveCSS('color', 'rgb(255, 255, 255)');

  await expect(lazyComponent).toHaveCSS('background-color', 'rgb(26, 26, 26)');
  await expect(lazyComponent).toHaveCSS('color', 'rgb(255, 255, 255)');

  // Verify no console errors occurred (no hydration errors)
  expect(consoleErrors).toEqual([]);
});
