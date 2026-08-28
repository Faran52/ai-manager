import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OutcomeImages } from './OutcomeImages';

test('renders embedded and remote outcome images', () => {
  render(
    <OutcomeImages outcome={{
      toolUseId: 't',
      status: 'ok',
      images: [
        {
          mediaType: 'image/png',
          data: 'aaa',
        },
        { url: 'https://example.com/image.png' },
        {},
      ],
    }}
    />,
  );

  expect(screen.getAllByRole('img')).toHaveLength(2);
});

test('opens and closes the full image viewer', async () => {
  render(
    <OutcomeImages outcome={{
      toolUseId: 't',
      status: 'ok',
      images: [{ url: 'https://example.com/image.png' }],
    }}
    />,
  );

  await userEvent.click(screen.getByLabelText('Open image viewer'));
  expect(screen.getByRole('dialog')).toBeDefined();

  await userEvent.click(screen.getAllByLabelText('Close image viewer')[1] ?? document.body);
  expect(screen.queryByRole('dialog')).toBeNull();
});
