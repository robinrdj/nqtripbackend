/**
 * The destinations and adventures the app ships with.
 *
 * The legacy `db.json` had randomly generated adventures ("Niaboytown", "Fort
 * Sionnnn") spread across cities that could not really host them, and no
 * coordinates at all. This catalogue replaces both: eight destinations chosen
 * because people genuinely go there for beaches, cycling, hill walks or
 * nightlife, and adventures that actually take place in each one.
 *
 * Adventures keep the legacy ids so bookmarked detail URLs and the migrated
 * reservations still resolve; only what an id points at has changed.
 *
 * Every `location` is the real feature on OpenStreetMap (the beach, peak,
 * trailhead, venue or street), or the Wikipedia coordinates where OSM had no
 * better match, so the map pin sits where the adventure happens.
 */
import type { AdventureCategory } from "../models/Adventure.js";

export interface Destination {
  id: string;
  city: string;
  country: string;
  description: string;
  /** Map centre and the point the weather forecast is read for. */
  location: { lat: number; lng: number };
}

export const DESTINATIONS: Destination[] = [
  {
    id: "goa",
    city: "Goa",
    country: "India",
    description: "Beaches, Portuguese forts and nightlife",
    location: { lat: 15.4909, lng: 73.8278 },
  },
  {
    id: "manali",
    city: "Manali",
    country: "India",
    description: "Himalayan treks, waterfalls and mountain roads",
    location: { lat: 32.2432, lng: 77.1892 },
  },
  {
    id: "bali",
    city: "Bali",
    country: "Indonesia",
    description: "Surf, volcanoes and rice terraces",
    location: { lat: -8.4095, lng: 115.1889 },
  },
  {
    id: "singapore",
    city: "Singapore",
    country: "Singapore",
    description: "Island trails, beaches and riverside nights",
    location: { lat: 1.3521, lng: 103.8198 },
  },
  {
    id: "cape-town",
    city: "Cape Town",
    country: "South Africa",
    description: "Table Mountain, penguins and Atlantic beaches",
    location: { lat: -33.9253, lng: 18.4239 },
  },
  {
    id: "barcelona",
    city: "Barcelona",
    country: "Spain",
    description: "City beaches, hilltop views and late nights",
    location: { lat: 41.3874, lng: 2.1686 },
  },
  {
    id: "rio-de-janeiro",
    city: "Rio de Janeiro",
    country: "Brazil",
    description: "Famous beaches, granite peaks and samba",
    location: { lat: -22.9111, lng: -43.2056 },
  },
  {
    id: "queenstown",
    city: "Queenstown",
    country: "New Zealand",
    description: "Alpine hikes and lakeside trails",
    location: { lat: -45.0311, lng: 168.6625 },
  },
];

export interface CatalogueEntry {
  city: string;
  name: string;
  subtitle: string;
  content: string;
  category: AdventureCategory;
  /** Hours. */
  duration: number;
  /** INR, like the rest of the data. */
  costPerHead: number;
  location: { lat: number; lng: number };
}

export const ADVENTURE_CATALOGUE: Record<string, CatalogueEntry> = {
  // --- Goa ----------------------------------------------------------------
  "8549673097": {
    city: "goa",
    name: "Dudhsagar Falls Jeep Safari",
    subtitle: "A four-tier waterfall in the Western Ghats",
    content:
      "Dudhsagar, the 'sea of milk', is one of India's tallest waterfalls, falling about 310 m down the Western Ghats inside Bhagwan Mahaveer Sanctuary. Jeeps from Collem ford streams and forest tracks to the base of the falls, where you can swim in the pool while trains cross the railway bridge above. The falls are at their fullest just after the monsoon.",
    category: "Hillside",
    duration: 8,
    costPerHead: 3500,
    location: { lat: 15.31562, lng: 74.31425 },
  },
  "0610512104": {
    city: "goa",
    name: "Tito's Lane Nightlife, Baga",
    subtitle: "North Goa's busiest party street",
    content:
      "Tito's Lane runs from the main road down to Baga Beach and has been the centre of Goa's nightlife for decades. Hop between Tito's, Café Mambo and the beach shacks, then finish the night on the sand. Entry to two clubs and a welcome drink are included.",
    category: "Party",
    duration: 5,
    costPerHead: 2500,
    location: { lat: 15.55501, lng: 73.75274 },
  },
  "7536826557": {
    city: "goa",
    name: "Chapora Fort Sunset Climb",
    subtitle: "Laterite ramparts above the Chapora river",
    content:
      "A short, steep climb leads to the ruined walls of Chapora Fort, built by the Portuguese in 1717 on the headland between Vagator beach and the Chapora river. The ramparts look out over the river mouth, the fishing boats and the sea, and are at their best at sunset.",
    category: "Hillside",
    duration: 3,
    costPerHead: 800,
    location: { lat: 15.60595, lng: 73.73528 },
  },
  "0733501601": {
    city: "goa",
    name: "Grande Island Snorkelling",
    subtitle: "Boat trip off the Mormugao peninsula",
    content:
      "A boat heads out to Grande Island at the mouth of the Zuari, often passing dolphins on the way. Snorkel over the rocks and reef around the island, then stop for lunch on a quiet cove. Masks, fins and life jackets are provided.",
    category: "Beaches",
    duration: 7,
    costPerHead: 2800,
    location: { lat: 15.35195, lng: 73.77723 },
  },
  "0606744025": {
    city: "goa",
    name: "Fontainhas Latin Quarter Ride",
    subtitle: "Portuguese Panaji by bicycle",
    content:
      "Fontainhas is Panaji's old Latin Quarter, a grid of narrow lanes lined with yellow, blue and ochre Portuguese-era houses. Ride past the Chapel of St Sebastian and up to the Church of Our Lady of the Immaculate Conception, stopping for poi bread and a Goan breakfast.",
    category: "Cycling",
    duration: 3,
    costPerHead: 1200,
    location: { lat: 15.49666, lng: 73.83108 },
  },
  "2621544733": {
    city: "goa",
    name: "Anjuna Flea Market & Curlies Sunset",
    subtitle: "The Wednesday market, then the beach",
    content:
      "Anjuna's Wednesday flea market has run beside the beach since the hippie era. Browse the stalls in the afternoon, then walk down to Curlies, the best-known shack on the beach, for sunset and the music that follows. Transport back to your hotel is included.",
    category: "Party",
    duration: 6,
    costPerHead: 2000,
    location: { lat: 15.56942, lng: 73.74256 },
  },
  "0534597016": {
    city: "goa",
    name: "Divar Island Village Ride",
    subtitle: "Ferries, paddy fields and old Goan houses",
    content:
      "Take the ferry from Old Goa across the Mandovi to Divar Island, where very little has changed in a century. The ride loops through paddy fields and fishing villages past Portuguese-era mansions, and climbs to the church of Our Lady of Compassion at Piedade for views back over the river.",
    category: "Cycling",
    duration: 5,
    costPerHead: 1500,
    location: { lat: 15.52509, lng: 73.90782 },
  },
  "7247489857": {
    city: "goa",
    name: "Old Goa Churches Cycle Trail",
    subtitle: "A UNESCO World Heritage Site on two wheels",
    content:
      "Old Goa was the capital of Portuguese India. Ride between the Basilica of Bom Jesus, which holds the remains of St Francis Xavier, the vast Sé Cathedral and the ruined tower of St Augustine, with a guide filling in the history.",
    category: "Cycling",
    duration: 4,
    costPerHead: 1300,
    location: { lat: 15.50087, lng: 73.91151 },
  },
  "6710850298": {
    city: "goa",
    name: "Palolem Beach Kayaking",
    subtitle: "South Goa's crescent bay",
    content:
      "Palolem is a calm crescent of sand backed by palms in South Goa. Kayak across the bay to the rocky islet at its northern end and on to Butterfly Beach, then spend the afternoon swimming. Kayaks, life jackets and lunch are included.",
    category: "Beaches",
    duration: 6,
    costPerHead: 2200,
    location: { lat: 15.00931, lng: 74.02423 },
  },
  "9312138770": {
    city: "goa",
    name: "Mayem Lake Countryside Ride",
    subtitle: "Back roads through Bicholim",
    content:
      "A quiet loop through the villages, cashew orchards and paddy fields of Bicholim, finishing at Mayem Lake, where you can take a pedal boat out on the water. The route is mostly flat and suits riders of any level.",
    category: "Cycling",
    duration: 4,
    costPerHead: 1400,
    location: { lat: 15.57461, lng: 73.94155 },
  },
  "5915383379": {
    city: "goa",
    name: "Cabo de Rama Fort Clifftop Hike",
    subtitle: "A ruined fort high above the Arabian Sea",
    content:
      "Cabo de Rama is a fort on the cliffs of South Goa. Walk the ramparts and the small chapel of St Anthony inside the walls, then take the steep path down to the pebble beach below. Best in the late afternoon.",
    category: "Hillside",
    duration: 5,
    costPerHead: 1200,
    location: { lat: 15.08741, lng: 73.91993 },
  },

  // --- Manali -------------------------------------------------------------
  "2447910730": {
    city: "manali",
    name: "Old Manali Café Night",
    subtitle: "Live music in the old village above the river",
    content:
      "Across the Manalsu stream from the town, Old Manali's lanes are full of cafés with fire pits, live bands and late kitchens. A local host takes you through three of them, from an early set with momos to a late-night jam session.",
    category: "Party",
    duration: 5,
    costPerHead: 1800,
    location: { lat: 32.25516, lng: 77.17659 },
  },
  "1773524915": {
    city: "manali",
    name: "Manali to Naggar Castle Ride",
    subtitle: "Down the left bank of the Beas",
    content:
      "Ride the quiet road along the left bank of the Beas through apple orchards and villages to Naggar, where a 15th-century castle built of stone and deodar wood looks down the Kullu valley. Lunch at the castle, then visit the Nicholas Roerich art gallery before the van brings you back.",
    category: "Cycling",
    duration: 6,
    costPerHead: 2400,
    location: { lat: 32.11199, lng: 77.16464 },
  },
  "0355034513": {
    city: "manali",
    name: "Gulaba Hill Climb",
    subtitle: "Switchbacks on the road to Rohtang",
    content:
      "A hard morning climb up the Manali–Leh highway through Kothi to Gulaba, at around 3,000 m, with the Beas gorge falling away beneath you and snow peaks ahead. A support vehicle follows, and the descent back to Manali is the reward.",
    category: "Cycling",
    duration: 6,
    costPerHead: 2800,
    location: { lat: 32.32231, lng: 77.20098 },
  },
  "2260150453": {
    city: "manali",
    name: "Jogini Falls Hike",
    subtitle: "From Vashisht's hot springs to a 150 m waterfall",
    content:
      "Start at Vashisht village and its hot springs, then follow the trail through pine forest and terraced fields to Jogini Falls, a long ribbon of water dropping off the cliffs above the valley. A gentle half-day walk, with chai at the stalls by the lower falls.",
    category: "Hillside",
    duration: 4,
    costPerHead: 1000,
    location: { lat: 32.27674, lng: 77.19055 },
  },
  "1921387712": {
    city: "manali",
    name: "Bhrigu Lake Trek",
    subtitle: "An alpine lake at 4,300 m",
    content:
      "Drive to Gulaba and climb through meadows above the treeline to Bhrigu Lake, a glacial lake at around 4,300 m with views across to the Pir Panjal range. A long, high day that needs good fitness; the lake is usually frozen until early summer.",
    category: "Hillside",
    duration: 11,
    costPerHead: 3500,
    location: { lat: 32.29326, lng: 77.2425 },
  },
  "7938812489": {
    city: "manali",
    name: "Solang Valley Paragliding",
    subtitle: "Tandem flights over the valley",
    content:
      "Solang Valley, 14 km from Manali, is the area's centre for paragliding in summer and skiing in winter. Take a tandem flight with a certified pilot from the slopes above the valley floor, then ride the ropeway up for the view of the surrounding peaks.",
    category: "Hillside",
    duration: 4,
    costPerHead: 3000,
    location: { lat: 32.3161, lng: 77.15656 },
  },
  "2757195090": {
    city: "manali",
    name: "Hadimba Temple & Deodar Forest Walk",
    subtitle: "A 16th-century wooden temple among the cedars",
    content:
      "The Hadimba Devi Temple was built in 1553 around a rock shrine, with a four-tiered pagoda roof and carved wooden doorways. Walk up through the Dhungri deodar forest that surrounds it, then on to the Manu Temple in Old Manali.",
    category: "Hillside",
    duration: 3,
    costPerHead: 700,
    location: { lat: 32.24844, lng: 77.18084 },
  },
  "3727396712": {
    city: "manali",
    name: "Sethan Village Snow Hike",
    subtitle: "A high hamlet below the Hampta Pass",
    content:
      "Sethan is a small village at around 2,700 m on the road towards the Hampta Pass, and one of the most reliable places near Manali for snow in winter. Hike the slopes above the village, try snowshoeing, and warm up with a home-cooked lunch.",
    category: "Hillside",
    duration: 7,
    costPerHead: 2600,
    location: { lat: 32.23603, lng: 77.2228 },
  },

  // --- Bali ---------------------------------------------------------------
  "2211420097": {
    city: "bali",
    name: "Potato Head Beach Club Sunset",
    subtitle: "Seminyak's landmark beach club",
    content:
      "Potato Head sits on the beach at Seminyak behind a facade made of reclaimed wooden window shutters. Arrive in the afternoon for the infinity pool and stay for sunset over the Indian Ocean, when the DJs take over.",
    category: "Party",
    duration: 5,
    costPerHead: 4000,
    location: { lat: -8.67941, lng: 115.14996 },
  },
  "8318638903": {
    city: "bali",
    name: "Mount Batur Sunrise Trek",
    subtitle: "Watch the sun rise from an active volcano",
    content:
      "Start in the dark at around 4 a.m. and climb Mount Batur's volcanic slopes by torchlight to the 1,717 m summit in time for sunrise over Lake Batur and Mount Agung. Breakfast is cooked on the steam vents near the crater rim.",
    category: "Hillside",
    duration: 7,
    costPerHead: 3500,
    location: { lat: -8.23889, lng: 115.3775 },
  },
  "3936107807": {
    city: "bali",
    name: "Jatiluwih Rice Terraces Ride",
    subtitle: "Cycling a UNESCO-listed landscape",
    content:
      "The terraces at Jatiluwih are part of the UNESCO-listed Subak system, Bali's thousand-year-old way of sharing irrigation water. Ride the farm roads that wind through them below Mount Batukaru, stopping to meet farmers working the paddies.",
    category: "Cycling",
    duration: 5,
    costPerHead: 3000,
    location: { lat: -8.3574, lng: 115.11879 },
  },
  "8632343612": {
    city: "bali",
    name: "Canggu Night Out",
    subtitle: "Batu Bolong's beach bars",
    content:
      "Canggu is Bali's surf-and-café town, and its nights centre on Batu Bolong. Start with sunset at the beach, move on to Old Man's for its live bands, and finish at the bars along Jalan Pantai Batu Bolong.",
    category: "Party",
    duration: 5,
    costPerHead: 2500,
    location: { lat: -8.65905, lng: 115.13086 },
  },
  "2629332143": {
    city: "bali",
    name: "Kintamani to Ubud Downhill Ride",
    subtitle: "25 km downhill through villages and rice fields",
    content:
      "Breakfast at Penelokan on the rim of the Batur caldera, then ride almost entirely downhill through villages, family compounds and rice fields towards Ubud. A support vehicle follows, and the guide stops at a coffee plantation on the way.",
    category: "Cycling",
    duration: 6,
    costPerHead: 3200,
    location: { lat: -8.28409, lng: 115.36497 },
  },
  "2212680653": {
    city: "bali",
    name: "Padang Padang Beach & Uluwatu Surf",
    subtitle: "A hidden cove on the Bukit peninsula",
    content:
      "Padang Padang is reached down a staircase through a gap in the limestone cliffs. Swim in the cove, watch the surfers on the famous left-hand reef break, and end the day at Uluwatu temple for the sunset Kecak fire dance.",
    category: "Beaches",
    duration: 6,
    costPerHead: 2600,
    location: { lat: -8.81122, lng: 115.10364 },
  },
  "1157691488": {
    city: "bali",
    name: "Campuhan Ridge Walk",
    subtitle: "A ridge-top path just outside Ubud",
    content:
      "The Campuhan Ridge Walk follows a paved path along a grassy ridge between two river valleys, starting near the Gunung Lebah temple in Ubud. It is best at sunrise, before the heat, and ends among rice fields and cafés in Bangkiang Sidem.",
    category: "Hillside",
    duration: 3,
    costPerHead: 900,
    location: { lat: -8.49902, lng: 115.25516 },
  },
  "0306928663": {
    city: "bali",
    name: "Kuta Beach Surf Lesson",
    subtitle: "Learn to surf on Bali's beginner beach",
    content:
      "Kuta's long sandy beach and gentle, sand-bottomed waves make it Bali's classic place to learn to surf. A two-hour lesson covers paddling and standing up, then stay on the beach for one of the island's best-known sunsets.",
    category: "Beaches",
    duration: 4,
    costPerHead: 2200,
    location: { lat: -8.71821, lng: 115.16876 },
  },
  "8729187639": {
    city: "bali",
    name: "USAT Liberty Wreck Snorkel, Tulamben",
    subtitle: "A WWII shipwreck just off the beach",
    content:
      "The USAT Liberty, a US Army cargo ship torpedoed in 1942, lies a short swim from the black-pebble beach at Tulamben. Its hull is covered in coral and swarming with fish, and the shallowest parts can be seen with just a mask and snorkel.",
    category: "Beaches",
    duration: 9,
    costPerHead: 3800,
    location: { lat: -8.27391, lng: 115.59261 },
  },

  // --- Singapore ----------------------------------------------------------
  "0301948003": {
    city: "singapore",
    name: "Clarke Quay Nightlife",
    subtitle: "Riverside bars and clubs",
    content:
      "Clarke Quay's restored 19th-century warehouses on the Singapore River are now the city's main nightlife strip. Start with drinks by the water, move on to the clubs, and catch a late river taxi back to Boat Quay.",
    category: "Party",
    duration: 5,
    costPerHead: 4500,
    location: { lat: 1.2896, lng: 103.84458 },
  },
  "9419621852": {
    city: "singapore",
    name: "Sentosa Siloso Beach Day",
    subtitle: "Singapore's island playground",
    content:
      "Take the Sentosa Express across to the island and spend the day at Siloso Beach: swimming, beach volleyball and stand-up paddleboarding. Walk along the shore to Palawan Beach and its rope bridge before sunset.",
    category: "Beaches",
    duration: 7,
    costPerHead: 4000,
    location: { lat: 1.25632, lng: 103.8122 },
  },
  "2019600638": {
    city: "singapore",
    name: "Pulau Ubin Island Ride",
    subtitle: "Singapore's last kampung",
    content:
      "A bumboat from Changi Point lands at Ubin Village, where you hire a bike and ride the island's trails past old kampung houses, quarry lakes and mangroves to the Chek Jawa wetlands boardwalk. Finish with seafood back by the jetty.",
    category: "Cycling",
    duration: 6,
    costPerHead: 2500,
    location: { lat: 1.4031, lng: 103.96971 },
  },
  "9362633268": {
    city: "singapore",
    name: "Bukit Timah Hill Summit Hike",
    subtitle: "Singapore's highest point",
    content:
      "Bukit Timah Nature Reserve protects primary rainforest on the island's highest hill (163 m). Climb to the summit and loop back through the forest, watching for long-tailed macaques. Short but steep and humid; start early.",
    category: "Hillside",
    duration: 3,
    costPerHead: 1200,
    location: { lat: 1.35469, lng: 103.77637 },
  },
  "1446001823": {
    city: "singapore",
    name: "East Coast Park Ride",
    subtitle: "15 km of seafront path",
    content:
      "East Coast Park has a continuous cycle path along the coast, with ships anchored offshore. Ride the length of it, stop to swim, and finish at the East Coast Lagoon Food Village for satay.",
    category: "Cycling",
    duration: 3,
    costPerHead: 1500,
    location: { lat: 1.30497, lng: 103.92708 },
  },
  "0925188554": {
    city: "singapore",
    name: "Marina Bay Night Ride",
    subtitle: "The skyline after dark",
    content:
      "Start at the Helix Bridge and loop around Marina Bay at night, past the Merlion, the Esplanade and Marina Bay Sands, ending at Gardens by the Bay for the Supertree light show.",
    category: "Cycling",
    duration: 3,
    costPerHead: 2800,
    location: { lat: 1.28752, lng: 103.86062 },
  },
  "5947843357": {
    city: "singapore",
    name: "Changi Beach & Coastal Boardwalk",
    subtitle: "Planes overhead, ships offshore",
    content:
      "Changi Beach Park is the quietest stretch of coast on the main island. Walk the Changi Point Coastal Boardwalk, swim, and watch planes come in low over the water before dinner at the Changi Village hawker centre.",
    category: "Beaches",
    duration: 4,
    costPerHead: 1300,
    location: { lat: 1.3912, lng: 103.99154 },
  },
  "3984110059": {
    city: "singapore",
    name: "Southern Ridges & Henderson Waves Walk",
    subtitle: "A treetop trail across the south of the island",
    content:
      "The Southern Ridges link Mount Faber, Telok Blangah Hill and Kent Ridge with bridges and forest walkways. Cross Henderson Waves, Singapore's highest pedestrian bridge at 36 m, and the canopy-level Forest Walk.",
    category: "Hillside",
    duration: 4,
    costPerHead: 1500,
    location: { lat: 1.27605, lng: 103.81541 },
  },

  // --- Cape Town ----------------------------------------------------------
  "8047300314": {
    city: "cape-town",
    name: "Sea Point Promenade Ride",
    subtitle: "Atlantic seafront from Mouille Point to Bantry Bay",
    content:
      "Cape Town's favourite seafront path runs along the Atlantic from Mouille Point lighthouse to Sea Point, with Lion's Head behind and waves breaking on the rocks beside you. Ride it end to end, then stop for a swim at the Sea Point Pavilion pool.",
    category: "Cycling",
    duration: 3,
    costPerHead: 2200,
    location: { lat: -33.90984, lng: 18.39013 },
  },
  "4327638849": {
    city: "cape-town",
    name: "Long Street Nightlife",
    subtitle: "Victorian balconies, bars and live music",
    content:
      "Long Street is lined with Victorian buildings and wrought-iron balconies, and after dark it is the centre of Cape Town's nightlife. A host leads you through its bars and live-music venues, from balcony drinks to late clubs.",
    category: "Party",
    duration: 5,
    costPerHead: 3000,
    location: { lat: -33.92099, lng: 18.42075 },
  },
  "9824784423": {
    city: "cape-town",
    name: "Camps Bay Beach Day",
    subtitle: "White sand below the Twelve Apostles",
    content:
      "Camps Bay is a wide white-sand beach backed by palm trees and the Twelve Apostles mountains. The Atlantic is cold, but the beach is the place to be on a summer afternoon, followed by sundowners on the strip behind it.",
    category: "Beaches",
    duration: 5,
    costPerHead: 1800,
    location: { lat: -33.95091, lng: 18.37772 },
  },
  "1371613966": {
    city: "cape-town",
    name: "Bree Street Bar Crawl",
    subtitle: "Cape Town's food and cocktail street",
    content:
      "Bree Street, one block over from Long Street, is where Cape Town's best small restaurants, wine bars and cocktail spots have gathered. Taste local wines and gin with a host across four venues.",
    category: "Party",
    duration: 4,
    costPerHead: 3500,
    location: { lat: -33.92051, lng: 18.41877 },
  },
  "3421411190": {
    city: "cape-town",
    name: "Lion's Head Sunrise Hike",
    subtitle: "Chains, ladders and a 360° view",
    content:
      "Lion's Head is the 669 m peak between Table Mountain and Signal Hill. The trail spirals around the mountain, with a few chain-and-ladder sections near the top, to a summit that looks over the city, the Atlantic seaboard and Robben Island. Go for sunrise, or for sunset at full moon.",
    category: "Hillside",
    duration: 3,
    costPerHead: 1500,
    location: { lat: -33.93504, lng: 18.38914 },
  },
  "8304353098": {
    city: "cape-town",
    name: "Boulders Beach Penguins",
    subtitle: "Swim with a colony of African penguins",
    content:
      "Boulders Beach near Simon's Town is a sheltered cove between huge granite boulders, and home to a colony of endangered African penguins. Watch them from the boardwalks, then swim in the calm water of the neighbouring beach.",
    category: "Beaches",
    duration: 5,
    costPerHead: 2500,
    location: { lat: -34.19807, lng: 18.45236 },
  },
  "5328424651": {
    city: "cape-town",
    name: "Muizenberg Surf Lesson",
    subtitle: "Warm water and colourful beach huts",
    content:
      "Muizenberg on False Bay has warmer water than the Atlantic side and long, gentle waves, which makes it the city's best place to learn to surf. Take a lesson, then photograph the row of brightly painted Victorian beach huts.",
    category: "Beaches",
    duration: 4,
    costPerHead: 2000,
    location: { lat: -34.09738, lng: 18.50435 },
  },
  "3366378787": {
    city: "cape-town",
    name: "Table Mountain via Platteklip Gorge",
    subtitle: "The direct route up the front of the mountain",
    content:
      "Platteklip Gorge is the most direct path up Table Mountain: a steep, stepped climb up the cleft in the middle of the mountain's front face to the flat summit at about 1,085 m. Walk across the top for the views, then take the cableway down.",
    category: "Hillside",
    duration: 5,
    costPerHead: 2800,
    location: { lat: -33.96019, lng: 18.41153 },
  },
  "5941490724": {
    city: "cape-town",
    name: "Cape Point Lighthouse Hike",
    subtitle: "Cliffs at the tip of the Cape Peninsula",
    content:
      "Cape Point is the rocky tip of the Cape Peninsula inside Table Mountain National Park. Walk up to the old lighthouse, then follow the Lighthouse Keeper's Trail along the cliffs and on to the Cape of Good Hope, watching for baboons, ostriches and whales offshore in season.",
    category: "Hillside",
    duration: 8,
    costPerHead: 4000,
    location: { lat: -34.35694, lng: 18.4969 },
  },

  // --- Barcelona ----------------------------------------------------------
  "0101381654": {
    city: "barcelona",
    name: "Barceloneta Beach Day",
    subtitle: "The city's beach, minutes from the old town",
    content:
      "Barceloneta is the city beach at the end of the old fishermen's quarter. Swim, rent a paddleboard, and finish with paella at one of the seafood restaurants along the Passeig Marítim.",
    category: "Beaches",
    duration: 5,
    costPerHead: 2500,
    location: { lat: 41.37933, lng: 2.19297 },
  },
  "2674554670": {
    city: "barcelona",
    name: "Bunkers del Carmel Sunset Hike",
    subtitle: "Civil War gun emplacements above the city",
    content:
      "The anti-aircraft batteries on the Turó de la Rovira were built during the Spanish Civil War, and their concrete platforms now give the best panoramic view of Barcelona, from the Sagrada Família to the sea. Walk up through the El Carmel neighbourhood and stay for sunset.",
    category: "Hillside",
    duration: 3,
    costPerHead: 1500,
    location: { lat: 41.41926, lng: 2.16154 },
  },
  "6216388298": {
    city: "barcelona",
    name: "El Born Tapas & Bar Crawl",
    subtitle: "Medieval streets around Santa Maria del Mar",
    content:
      "El Born's narrow medieval streets around the Passeig del Born and the church of Santa Maria del Mar are full of tapas bars, vermouth bars and cocktail spots. A local host takes you through four of them.",
    category: "Party",
    duration: 4,
    costPerHead: 4500,
    location: { lat: 41.38476, lng: 2.18281 },
  },
  "2273854765": {
    city: "barcelona",
    name: "Carretera de les Aigües Ride",
    subtitle: "A flat gravel track along the Collserola hills",
    content:
      "The Carretera de les Aigües is an old water-board road that contours along the Collserola hills above the city, almost completely flat, with Barcelona and the sea laid out below. Take the funicular up to Vallvidrera to start the ride.",
    category: "Cycling",
    duration: 4,
    costPerHead: 3500,
    location: { lat: 41.41535, lng: 2.12304 },
  },
  "9828912080": {
    city: "barcelona",
    name: "Razzmatazz Club Night",
    subtitle: "Five rooms in a Poblenou warehouse",
    content:
      "Razzmatazz is Barcelona's largest club, five rooms of indie, techno and pop in a converted warehouse in Poblenou. Start with dinner nearby, skip the queue with pre-booked entry, and dance until the early hours.",
    category: "Party",
    duration: 6,
    costPerHead: 3500,
    location: { lat: 41.39759, lng: 2.19125 },
  },
  "2052303734": {
    city: "barcelona",
    name: "Bogatell Beach Volleyball",
    subtitle: "The locals' beach in Poblenou",
    content:
      "Bogatell is quieter than Barceloneta and popular with locals. Join a beach volleyball session on the public courts, swim, and stay for drinks at a chiringuito as the sun goes down.",
    category: "Beaches",
    duration: 4,
    costPerHead: 2000,
    location: { lat: 41.39395, lng: 2.20667 },
  },
  "3396851354": {
    city: "barcelona",
    name: "Seafront Ride from Port Olímpic",
    subtitle: "Five beaches on one bike path",
    content:
      "Start at Port Olímpic, the marina built for the 1992 Olympics, and ride the seafront bike path past the city's beaches from Barceloneta to the Fòrum, stopping wherever you want to swim.",
    category: "Cycling",
    duration: 3,
    costPerHead: 2500,
    location: { lat: 41.38613, lng: 2.19983 },
  },
  "3409781073": {
    city: "barcelona",
    name: "Montjuïc Castle Hike",
    subtitle: "Gardens and a hilltop fortress over the port",
    content:
      "Walk up Montjuïc from Poble-sec through its terraced gardens to the 17th-century castle at the top, with views over the port and out to sea. Come down past the Olympic Stadium and the Magic Fountain.",
    category: "Hillside",
    duration: 4,
    costPerHead: 2200,
    location: { lat: 41.36338, lng: 2.16614 },
  },
  "6302945339": {
    city: "barcelona",
    name: "Tibidabo Summit Hike",
    subtitle: "The highest point in Barcelona",
    content:
      "Tibidabo, at 512 m, is the highest peak in the Collserola range. Hike up through the forest of Collserola park to the summit, with its church and century-old amusement park, for the widest view over the city and the coast.",
    category: "Hillside",
    duration: 5,
    costPerHead: 2400,
    location: { lat: 41.42315, lng: 2.11994 },
  },

  // --- Rio de Janeiro -----------------------------------------------------
  "0453764985": {
    city: "rio-de-janeiro",
    name: "Morro da Urca Trail to Sugarloaf",
    subtitle: "Walk the first leg, ride the cable car up",
    content:
      "Starting from Praia Vermelha, the Pista Cláudio Coutinho path runs along the base of Sugarloaf, where marmosets live in the trees. A steep trail then climbs to the top of Morro da Urca, from where the cable car carries you to the summit of Sugarloaf Mountain.",
    category: "Hillside",
    duration: 4,
    costPerHead: 3000,
    location: { lat: -22.953, lng: -43.15838 },
  },
  "1248029271": {
    city: "rio-de-janeiro",
    name: "Copacabana Beach Day",
    subtitle: "Four kilometres of the world's most famous sand",
    content:
      "Copacabana's beach runs for about 4 km along its wave-patterned promenade. Rent a chair and umbrella from a barraca, play footvolley, swim, and drink coconut water and caipirinhas from the kiosks.",
    category: "Beaches",
    duration: 5,
    costPerHead: 2000,
    location: { lat: -22.9757, lng: -43.18662 },
  },
  "0103492831": {
    city: "rio-de-janeiro",
    name: "Lapa Night Out",
    subtitle: "Samba under the arches",
    content:
      "Lapa is the heart of Rio's nightlife, centred on the 18th-century aqueduct arches of the Arcos da Lapa. Join the street party under the arches, then go into the samba and forró clubs along Rua do Lavradio and Avenida Mem de Sá.",
    category: "Party",
    duration: 6,
    costPerHead: 3000,
    location: { lat: -22.91303, lng: -43.17996 },
  },
  "5568011370": {
    city: "rio-de-janeiro",
    name: "Pedra do Sal Samba Night",
    subtitle: "Street samba where it was born",
    content:
      "Pedra do Sal, in the Little Africa district near the port, is a rock with steps carved into it where freed slaves and dock workers once gathered, and where samba took shape. On Monday and Friday nights, musicians play around a table in the square and the crowd sings along.",
    category: "Party",
    duration: 4,
    costPerHead: 2200,
    location: { lat: -22.89804, lng: -43.18541 },
  },
  "8138418941": {
    city: "rio-de-janeiro",
    name: "Arpoador Sunset & Ipanema Beach",
    subtitle: "Applause for the sunset",
    content:
      "Spend the afternoon on Ipanema beach, then climb the Pedra do Arpoador, the rocky point between Ipanema and Copacabana. As the sun sets behind the Morro Dois Irmãos, the crowd on the rock traditionally applauds.",
    category: "Beaches",
    duration: 5,
    costPerHead: 1800,
    location: { lat: -22.99039, lng: -43.19041 },
  },
  "8993280816": {
    city: "rio-de-janeiro",
    name: "Lagoa Rodrigo de Freitas Ride",
    subtitle: "A 7.5 km loop below Corcovado",
    content:
      "The lagoon behind Ipanema and Leblon has a 7.5 km cycle path around it, with Christ the Redeemer watching from Corcovado above. Loop it at an easy pace and stop at the lakeside kiosks for a drink.",
    category: "Cycling",
    duration: 3,
    costPerHead: 1800,
    location: { lat: -22.97163, lng: -43.21206 },
  },
  "9536498117": {
    city: "rio-de-janeiro",
    name: "Morro Dois Irmãos Hike",
    subtitle: "The best view of Ipanema and Leblon",
    content:
      "Start with a moto-taxi up through the Vidigal favela, then hike the short, steep trail to the top of Dois Irmãos. The summit looks straight down the length of Leblon and Ipanema beaches, with Sugarloaf beyond and Rocinha on the other side.",
    category: "Hillside",
    duration: 4,
    costPerHead: 2500,
    location: { lat: -22.99494, lng: -43.24891 },
  },
  "2008775850": {
    city: "rio-de-janeiro",
    name: "Parque Lage Trail to Christ the Redeemer",
    subtitle: "Hike up through the Tijuca Forest",
    content:
      "Start at the mansion and gardens of Parque Lage and climb through the Tijuca rainforest, using chains on the steepest sections, to the statue of Christ the Redeemer at the top of Corcovado. Take the train or van back down.",
    category: "Hillside",
    duration: 5,
    costPerHead: 3500,
    location: { lat: -22.95941, lng: -43.21189 },
  },

  // --- Queenstown ---------------------------------------------------------
  "6905241907": {
    city: "queenstown",
    name: "Queenstown Bar Crawl",
    subtitle: "Lanes and lakefront bars in the town centre",
    content:
      "Queenstown's compact centre packs pubs, cocktail bars and clubs into a few streets and lanes off the lakefront. A host leads the crawl through five of them, starting on Searle Lane.",
    category: "Party",
    duration: 5,
    costPerHead: 4500,
    location: { lat: -45.03251, lng: 168.66133 },
  },
  "5770077080": {
    city: "queenstown",
    name: "Queenstown Trail to Kawarau Bridge",
    subtitle: "Gorges, river crossings and the first bungy",
    content:
      "Ride the Arrow River Bridges section of the Queenstown Trail from Arrowtown, crossing gorges on suspension bridges, to the historic Kawarau Gorge Suspension Bridge, home of the world's first commercial bungy jump in 1988.",
    category: "Cycling",
    duration: 5,
    costPerHead: 6000,
    location: { lat: -45.00875, lng: 168.89965 },
  },
  "6298356896": {
    city: "queenstown",
    name: "Tiki Trail & Skyline Gondola",
    subtitle: "Climb to Bob's Peak, then ride the luge",
    content:
      "The Tiki Trail climbs steeply through the forest beneath the Skyline Gondola to Bob's Peak, about 450 m above town, with a view over Lake Wakatipu to the Remarkables. Reward yourself with a few runs on the luge at the top, then take the gondola down.",
    category: "Hillside",
    duration: 3,
    costPerHead: 4500,
    location: { lat: -45.02752, lng: 168.65246 },
  },
  "3365319720": {
    city: "queenstown",
    name: "Ben Lomond Summit Track",
    subtitle: "Queenstown's big day hike",
    content:
      "From the top of the gondola, the Ben Lomond track climbs above the bush line to the saddle and then the 1,748 m summit, with views over Lake Wakatipu and the Southern Alps. A long, demanding day that rewards good fitness.",
    category: "Hillside",
    duration: 8,
    costPerHead: 5000,
    location: { lat: -45.00704, lng: 168.61556 },
  },
  "9680463758": {
    city: "queenstown",
    name: "Queenstown Hill Time Walk",
    subtitle: "To the Basket of Dreams",
    content:
      "A well-marked track climbs through pine forest straight from town, with plaques along the way telling the area's history, to the 'Basket of Dreams' sculpture and the summit of Queenstown Hill above the lake.",
    category: "Hillside",
    duration: 3,
    costPerHead: 2500,
    location: { lat: -45.00867, lng: 168.69242 },
  },
  "5244806429": {
    city: "queenstown",
    name: "Frankton Track Lakeside Ride",
    subtitle: "An easy ride along Lake Wakatipu",
    content:
      "The Frankton Track follows the shore of Lake Wakatipu from Queenstown Gardens to Frankton, flat and sheltered, with the Remarkables across the water. Continue to the Kawarau Falls bridge before riding back.",
    category: "Cycling",
    duration: 3,
    costPerHead: 3500,
    location: { lat: -45.02756, lng: 168.69115 },
  },
  "3077909052": {
    city: "queenstown",
    name: "Lake Alta Hike, The Remarkables",
    subtitle: "An alpine lake below Double Cone",
    content:
      "Drive up to the Remarkables ski area and hike past the base buildings to Lake Alta, a glacial tarn below the range's highest peak, Double Cone. A short alpine walk with big views; covered in snow in winter.",
    category: "Hillside",
    duration: 4,
    costPerHead: 4000,
    location: { lat: -45.06371, lng: 168.81076 },
  },
  "5308549680": {
    city: "queenstown",
    name: "Gibbston Valley Wine Ride",
    subtitle: "Cycle between Central Otago's pinot noir cellars",
    content:
      "The Gibbston River Trail links the cellar doors of the Gibbston Valley, the 'Valley of Vines', along the Kawarau River. Ride between tastings of Central Otago pinot noir, with lunch at Gibbston Valley Winery.",
    category: "Cycling",
    duration: 5,
    costPerHead: 6500,
    location: { lat: -45.01228, lng: 168.91515 },
  },
};
