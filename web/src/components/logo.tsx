import Image from 'next/image';

// Logo FamilyPay réutilisable partout sur le web.
//
// Wrappé dans next/image (pas <img>) pour éviter le lint @next/next/no-img-element
// et bénéficier de l'optimisation d'images. width/height fixent le ratio
// intrinsèque (l'image source est carrée) ; la taille affichée est contrôlée
// par le `className` Tailwind (size-8, size-12…) passé par l'appelant.
// `priority` car le logo est au-dessus de la ligne de flottaison (nav, auth).
// Fonctionne dans les Server et Client Components.
export function Logo({ className, alt = 'FamilyPay' }: { className?: string; alt?: string }) {
  return (
    <Image src="/logo.png" alt={alt} width={128} height={128} className={className} priority />
  );
}
