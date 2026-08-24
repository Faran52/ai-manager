import { render, screen } from '@testing-library/react';

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
