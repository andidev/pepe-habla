import type { PoseName } from './vocabulary';

export interface Greeting {
  /** What Pepe says. */
  es: string;
  /** The gloss underneath, for an A2 reader who has not met the slang yet. */
  en: string;
}

/**
 * What Pepe says when you open the app.
 *
 * Paired to the pose rather than drawn from one pile: sleeping Pepe shouting
 * encouragement reads as a bug, while sleeping Pepe asking for five more
 * minutes reads as a joke. Each pose therefore gets lines only it could say.
 *
 * Two rules hold across the list. Anything addressed to *you* avoids gendered
 * adjectives, because Spanish would otherwise assume the reader's gender --
 * hence `imparable` and `fuerte` (invariant) and `estrella` (a noun used for
 * anyone) rather than `listo` or `bienvenido`. Anything Pepe says about
 * himself is masculine, since Pepe is el perro.
 *
 * Typed as Record<PoseName, ...>, so adding a pose without lines for it is a
 * compile error rather than a blank splash.
 */
export const GREETINGS: Record<PoseName, readonly Greeting[]> = {
  // Standing, neutral. The everyday hellos.
  idle: [
    { es: '¡Órale!', en: 'Hey! / Wow!' },
    { es: '¿Qué onda?', en: "What's up?" },
    { es: '¡Ándale pues!', en: 'Alright then!' },
    { es: '¡Hola, compa!', en: 'Hey, buddy!' },
    { es: '¿Le entramos al jale?', en: 'Shall we get to work?' },
    { es: '¡Aquí andamos!', en: 'Here we are!' },
    { es: '¡Qué gusto verte!', en: 'Good to see you!' },
    { es: '¡Qué bueno que volviste!', en: 'Good thing you came back!' },
    { es: '¿Empezamos?', en: 'Shall we start?' },
  ],

  // Sitting, tongue out, delighted. Praise and hyperbole.
  happy: [
    { es: '¡Qué padre!', en: 'How cool!' },
    { es: '¡Vientos!', en: 'Awesome!' },
    { es: '¡Chido!', en: 'Cool!' },
    { es: '¡Vas que vuelas!', en: "You're flying along!" },
    { es: '¡Te luciste!', en: 'You outdid yourself!' },
    { es: '¡Así se hace!', en: "That's how it's done!" },
    { es: '¡Qué bárbaro!', en: 'Incredible!' },
    { es: '¡Estás imparable!', en: "You're unstoppable!" },
    { es: '¡Eres una estrella!', en: "You're a star!" },
    { es: '¡Hablas mejor que mi primo!', en: 'You speak better than my cousin!' },
  ],

  // Luchador Pepe: mask and cape. Everything here is lucha libre.
  excited: [
    { es: '¡A darle!', en: "Let's get to it!" },
    { es: '¡Échale ganas!', en: 'Give it your best!' },
    { es: '¡Vámonos recio!', en: "Let's go hard!" },
    { es: '¡Con todo!', en: 'All in!' },
    { es: '¡Sin miedo!', en: 'No fear!' },
    { es: '¡Eres más fuerte que el Santo!', en: "You're stronger than El Santo!" },
    { es: '¡Dos de tres caídas!', en: 'Two out of three falls!' },
    { es: '¡Máscara contra cabellera!', en: 'Mask versus hair!' },
    { es: '¡Llegó la estrella!', en: 'The star has arrived!' },
  ],

  // The big sombrero. Festive and a little grand.
  hero: [
    { es: '¡Vámonos!', en: "Let's go!" },
    { es: '¡Arriba!', en: 'Yeah! / Let\'s go!' },
    { es: '¡Qué elegancia!', en: 'Such elegance!' },
    { es: '¡Puro México!', en: 'Pure Mexico!' },
    { es: '¡Ay, ay, ay!', en: 'Oh my!' },
    { es: '¡Que empiece la fiesta!', en: 'Let the party start!' },
    { es: '¡Salud!', en: 'Cheers!' },
    { es: '¡Viva el español!', en: 'Long live Spanish!' },
    { es: '¿Te gusta mi sombrero?', en: 'Do you like my hat?' },
  ],

  // Lying down, dozing. Reluctant, and mostly about food.
  sleeping: [
    { es: '¿Ya despertaste?', en: 'Are you awake yet?' },
    { es: 'Cinco minutos más...', en: 'Five more minutes...' },
    { es: '¿Y mi taco?', en: "Where's my taco?" },
    { es: 'Soñaba con tacos.', en: 'I was dreaming about tacos.' },
    { es: 'Despiértame para la comida.', en: 'Wake me up for lunch.' },
    { es: 'Una siestecita más.', en: 'One more little nap.' },
    { es: 'Estaba soñando en español.', en: 'I was dreaming in Spanish.' },
    { es: '¿Ya es hora?', en: 'Is it time already?' },
  ],

  // Curled up beside a calavera. Affectionate guilt, played for laughs.
  sad: [
    { es: '¿Dónde andabas?', en: 'Where have you been?' },
    { es: 'Te extrañé.', en: 'I missed you.' },
    { es: 'Pensé que ya no volvías.', en: "I thought you weren't coming back." },
    { es: '¿Me trajiste un taco?', en: 'Did you bring me a taco?' },
    { es: 'Ya no me dejes solo.', en: "Don't leave me on my own again." },
    { es: 'Llevo días esperándote.', en: "I've been waiting days for you." },
    { es: 'Mi corazón estaba triste.', en: 'My heart was sad.' },
  ],
};
