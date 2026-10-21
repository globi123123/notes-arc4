/** Word list for Word Rain: common, friendly English words, lowercase. */

const WORDS = `
art bay bee bow box cap cat cup day dew dog dot ear egg elm fan fig fin fog fox fun gem gum hat hay hen hop ice ink ivy jam jar jet joy key kit lap leaf log map mat mix mud nap net nut oak oat owl pan pea pen pie pin pot ray rib rug run sap saw sea sip sky sun tea tin toe top toy van web wig yak zip
acorn amber apple arrow aspen badge baker basil beach berry bloom board brave bread brick brush cabin camel candy canoe cedar chalk charm cider clay cliff cloud clover cocoa coral crane creek crisp crown daisy dance delta denim diary dream drift eagle earth ember fable feast fern field flame flute frost fruit gecko ghost giant glade globe grain grape grass green grove guide happy harbor hazel heart honey horse hotel house igloo image ivory jelly jewel juice kayak kite koala lake lemon light lilac linen llama lodge lunar magic mango maple march marsh melon metal mint moose moss mouse music night noble north ocean olive onion opera orbit otter paint panda paper peach pearl pecan petal piano pilot pixel plant plaza plum polar pond poppy quail quiet quilt radio raven ridge river robin rocket rose ruby saddle salad sand scarf seed shade shell shore silk skate slope smile snack snow solar spark spice spoon spring squid stamp star stone storm sugar swift table tango thyme tiger toast torch tower trail tulip tuner umbra vapor velvet violet wagon whale wheat willow window winter world yacht yarn yeast zebra
balloon bicycle blanket blossom breeze cabinet cactus canvas caramel castle cherry chimney circle compass cookie cottage crystal curtain desert dolphin dragon emerald engine feather festival forest fountain garden gallery glacier harvest hedgehog horizon island jacket journey kettle kingdom ladder lantern library lighthouse marble meadow mirror morning mountain mushroom napkin necklace orchard origami pancake parrot pebble pelican pepper picnic pillow planet pocket puzzle rainbow saffron sailboat seagull shadow silver sparrow spinach squirrel station sunrise sunset teapot thunder tractor treasure tunnel turtle umbrella valley village volcano walnut weather whistle wonder
adventure afternoon avalanche butterfly calendar chocolate cinnamon dandelion daydream evergreen fireplace firework framework gingerbread grasshopper hammock harmonica hurricane invention jellyfish kaleidoscope landscape lemonade marigold midnight moonlight notebook observatory peppermint pineapple porcupine raspberry sandcastle saxophone skyscraper snowflake strawberry submarine sunflower telescope thunderstorm tortoise trampoline waterfall watermelon wilderness woodpecker
`
  .split(/\s+/)
  .filter(Boolean);

/** Words grouped by length for quick picking. */
export const WORDS_BY_LENGTH = WORDS.reduce((groups, word) => {
  (groups[word.length] ||= []).push(word);
  return groups;
}, {});

export const ALL_WORDS = WORDS;
