const linkClass = 'underline underline-offset-2 hover:text-ink';

const SOURCES = [
  ['https://www.metmuseum.org/about-the-met/policies-and-documents/open-access', 'The Metropolitan Museum of Art Open Access (CC0)'],
  ['https://www.clevelandart.org/open-access', 'Cleveland Museum of Art Open Access (CC0)'],
  ['https://data.rijksmuseum.nl/', 'Rijksmuseum Data Services (CC0, Public Domain Mark)'],
  ['https://www.nga.gov/artworks/free-images-and-open-access', 'National Gallery of Art Open Access (CC0)'],
] as const;

export function AttributionFooter() {
  return (
    <footer className="px-6 py-12 text-center font-mono text-[11px] leading-relaxed text-ink/50">
      Images and data:{' '}
      {SOURCES.map(([href, label], i) => (
        <span key={href}>
          <a className={linkClass} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
          {i < SOURCES.length - 2 ? ', ' : i === SOURCES.length - 2 ? ' and ' : '.'}
        </span>
      ))}
    </footer>
  );
}
