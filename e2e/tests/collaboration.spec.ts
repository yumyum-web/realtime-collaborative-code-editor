import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should allow user to login", async ({ page }) => {
    // Navigate to login page
    await page.goto("http://localhost:3000/login");

    // Fill in login form
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard or home page
    await page.waitForURL("**/projects");

    // Verify we're logged in
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("http://localhost:3000/login");

    await page.fill('input[name="email"]', "wrong@example.com");
    await page.fill('input[name="password"]', "wrongpassword");

    await page.click('button[type="submit"]');

    // Check for error message
    await expect(page.locator("text=invalid-credential")).toBeVisible();
  });
});

test.describe("Project Creation and Collaboration", () => {
  test("should create a new project and allow real-time editing", async ({
    browser,
  }) => {
    // Create two browser contexts (simulating two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1: Login and create project
    await page1.goto("http://localhost:3000/login");
    await page1.fill('input[name="email"]', "user1@example.com");
    await page1.fill('input[name="password"]', "password123");
    await page1.click('button[type="submit"]');
    await page1.waitForURL("**/projects");

    // Create new project
    await page1.click("text=Create Project");
    await page1.fill('input[name="projectName"]', "Test Collaborative Project");
    await page1.click('button[type="create"]');

    // Get project URL
    const projectUrl = page1.url();

    // User 2: Login and join the project
    await page2.goto("http://localhost:3000/login");
    await page2.fill('input[name="email"]', "user2@example.com");
    await page2.fill('input[name="password"]', "password123");
    await page2.click('button[type="submit"]');
    await page2.waitForURL("**/projects");

    // Navigate to the project (assuming they have access)
    await page2.goto(projectUrl);

    // User 1 types in editor
    const editor1 = page1.locator(".monaco-editor");
    await editor1.click();
    await page1.keyboard.type('console.log("Hello from User 1")');

    // User 2 should see the changes
    const editor2 = page2.locator(".monaco-editor");
    await expect(editor2).toContainText('console.log("Hello from User 1")');

    // User 2 types
    await editor2.click();
    await page2.keyboard.press("End");
    await page2.keyboard.type('\nconsole.log("Hello from User 2")');

    // User 1 should see User 2's changes
    await expect(editor1).toContainText('console.log("Hello from User 2")');

    await context1.close();
    await context2.close();
  });
});
