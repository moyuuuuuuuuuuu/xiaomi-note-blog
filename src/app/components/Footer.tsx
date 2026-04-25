import { Github, Heart } from 'lucide-react';

interface FooterProps {
  siteName: string;
}

export function Footer({ siteName }: FooterProps) {
  return (
    <footer className="mt-16 py-8 bg-white/50 backdrop-blur-sm border-t border-gray-200">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Made with</span>
            <Heart className="size-4 text-red-500 fill-red-500" />
            <span>by the moyuuuuuuuu</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <a 
              href="https://github.com/moyuuuuuuuuuuu/xiaomi-note-blog"
              className="text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
            >
              <Github className="size-4" />
              <span>GitHub</span>
            </a>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">
              © 2026 {siteName}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
