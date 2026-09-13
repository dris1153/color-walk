const linkClass = 'underline underline-offset-2 hover:text-ink';

export function AttributionFooter() {
  return (
    <footer className="px-6 py-12 text-center font-mono text-[11px] leading-relaxed text-ink/50">
      Images and data:{' '}
      <a
        className={linkClass}
        href="https://www.metmuseum.org/about-the-met/policies-and-documents/open-access"
        target="_blank"
        rel="noopener noreferrer"
      >
        The Metropolitan Museum of Art Open Access (CC0)
      </a>{' '}
      and{' '}
      <a
        className={linkClass}
        href="https://www.clevelandart.org/open-access"
        target="_blank"
        rel="noopener noreferrer"
      >
        Cleveland Museum of Art Open Access (CC0)
      </a>
      .
    </footer>
  );
}
