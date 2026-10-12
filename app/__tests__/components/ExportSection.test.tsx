import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ExportSection } from '@/components/ExportSection';
import { DbProvider } from '@/db/DbProvider';
import { createPerson } from '@/db/people';
import { shareFile } from '@/export/share';

import { createTestDb } from '../../testing/testDb';

jest.mock('@/export/share', () => ({ shareFile: jest.fn() }));

const share = shareFile as jest.MockedFunction<typeof shareFile>;

async function renderSection() {
  const db = await createTestDb();
  await createPerson(
    db,
    {
      name: 'Margaret Lin',
      preferredName: 'Maggie',
      nicknames: [],
      relationship: null,
      birthday: null,
      address: null,
      phone: null,
      interests: ['pottery'],
      notes: [],
    },
    new Date(),
  );
  await render(
    <DbProvider db={db}>
      <ExportSection />
    </DbProvider>,
  );
}

describe('ExportSection', () => {
  beforeEach(() => share.mockReset());

  it('shares the markdown export', async () => {
    share.mockResolvedValue();
    await renderSection();

    await fireEvent.press(screen.getByTestId('export-markdown'));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [fileName, contents, uti] = share.mock.calls[0];
    expect(fileName).toMatch(/^little-things-people-\d{4}-\d{2}-\d{2}\.md$/);
    expect(contents).toContain('## Margaret Lin\n');
    expect(contents).toContain('- pottery\n');
    expect(uti).toBe('net.daringfireball.markdown');
  });

  it('shares the json export', async () => {
    share.mockResolvedValue();
    await renderSection();

    await fireEvent.press(screen.getByTestId('export-json'));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [fileName, contents, uti] = share.mock.calls[0];
    expect(fileName).toMatch(/^little-things-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(contents).people[0].name).toBe('Margaret Lin');
    expect(uti).toBe('public.json');
  });

  it('shows the error when sharing fails', async () => {
    share.mockRejectedValue(new Error('boom'));
    await renderSection();

    await fireEvent.press(screen.getByTestId('export-json'));

    expect(await screen.findByText('Export failed: boom')).toBeTruthy();
  });
});
