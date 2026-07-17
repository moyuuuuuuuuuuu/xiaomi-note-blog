interface FooterProps {
  siteName: string;
}

export function Footer({ siteName }: FooterProps) {
  return (
    <footer className="minimal-footer">
      <div className="editorial-container minimal-footer-inner">
        <span>© {new Date().getFullYear()} {siteName}</span>
        <span>PERSONAL NOTES ARCHIVE</span>
      </div>
    </footer>
  );
}
