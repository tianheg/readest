import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { Book } from '@/types/book';
import type { SystemSettings } from '@/types/settings';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (text: string) => text,
}));

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {}, appService: null }),
}));

const { default: TransferQueuePanel } = await import('@/app/library/components/TransferQueuePanel');

const localOnlyBook: Book = {
  hash: 'book-1',
  format: 'EPUB',
  title: 'Title',
  author: 'Author',
  createdAt: 1000,
  updatedAt: 1000,
  downloadedAt: 1000,
};

const withSettings = (overrides: Partial<SystemSettings> = {}) =>
  useSettingsStore.setState({ settings: { version: 1, ...overrides } as SystemSettings });

beforeEach(() => {
  useLibraryStore.setState({ getVisibleLibrary: () => [localOnlyBook] });
});

afterEach(cleanup);

describe('TransferQueuePanel Upload All', () => {
  // Fork: `uploadAllowed` needs an active Readest Cloud storage, which is
  // hard-off in this build — the bulk button can never render, so the
  // "still queued" book below would have no vendor destination anyway.
  it('is never offered — no Readest Cloud storage to upload to', () => {
    withSettings();
    render(<TransferQueuePanel />);
    expect(screen.queryByLabelText('Upload All')).toBeNull();
  });

  // Uploads made with Books sync off never get a `books` row, so no other
  // device could list them.
  it('is hidden while Books sync is off', () => {
    withSettings({ syncCategories: { book: false } } as Partial<SystemSettings>);
    render(<TransferQueuePanel />);
    expect(screen.queryByLabelText('Upload All')).toBeNull();
  });
});

describe('TransferQueuePanel Download All', () => {
  const cloudOnlyBook: Book = {
    ...localOnlyBook,
    hash: 'book-2',
    downloadedAt: null,
    uploadedAt: 1000,
  };

  // Fork: `booksToDownload` also requires an active Readest Cloud storage, so
  // the bulk button stays hidden even with cloud-copy books present. Per-book
  // download (incl. WebDAV-mirrored copies) goes through
  // useBookTransferActions and is unaffected; the background-toast mechanism
  // (#6418) is still covered by transfer-manager's `supports isBackground` test.
  it('is never offered — no Readest Cloud storage to download from', () => {
    withSettings();
    useLibraryStore.setState({ getVisibleLibrary: () => [cloudOnlyBook] });

    render(<TransferQueuePanel />);
    expect(screen.queryByLabelText('Download All')).toBeNull();
  });
});
