import { Reveal } from './motion/Reveal';

interface HomeHeroProps {
  siteName: string;
  siteDescription: string;
  noteCount: number;
}

export function HomeHero({ siteName, siteDescription, noteCount }: HomeHeroProps) {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div>
        <Reveal><p className="home-kicker">Personal notes · {new Date().getFullYear()}</p></Reveal>
        <Reveal delay={0.06}><h1 id="home-title">记录思考，<br />保留瞬间。</h1></Reveal>
      </div>
      <Reveal className="home-intro" delay={0.12}>
        <p>{siteDescription || `${siteName}中的日常记录。`}</p>
        <p className="home-count"><strong>{noteCount}</strong><span>NOTES IN ARCHIVE</span></p>
      </Reveal>
    </section>
  );
}
