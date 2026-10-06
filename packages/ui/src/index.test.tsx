import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TechnicalStatus } from './index';
it('renders accessible status without interpreting user content as HTML', () => {
  const html = renderToStaticMarkup(
    <TechnicalStatus>{'<script>alert(1)</script>'}</TechnicalStatus>,
  );
  expect(html).toContain('role="status"');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
});
