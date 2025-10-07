import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/BOB the Skelly/);
});

test('loads audio file and shows master track editor', async ({ page }) => {
  await page.goto('/');

  // Get the file input element
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Click or drop an audio file here').click();
  const fileChooser = await fileChooserPromise;

  // Set the input file to our silent WAV
  await fileChooser.setFiles('e2e/fixtures/silent.wav');

  // Wait for the processing to finish and the editor to appear
  // We expect the Master Track Editor heading to be visible
  const editorTitle = page.getByRole('heading', { name: 'Master Track Editor' });
  await expect(editorTitle).toBeVisible({ timeout: 10000 }); // 10s timeout for processing

  // We also expect the segmentation tools to be there
  const segmentationTitle = page.getByRole('heading', { name: 'Segmentation Tools' });
  await expect(segmentationTitle).toBeVisible();
});
