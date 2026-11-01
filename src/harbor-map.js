// Coordinates use the supplied illustration's 1448 × 1086 pixel space, Y down.
export const MAP_WIDTH = 1448, MAP_HEIGHT = 1086;
export const FISHERMAN = { x: 637, y: 701 };
export const ROD_GRIP = { x: 655, y: 655 };
export const ROD_TIP = { x: 745, y: 620 };

export const BOATS = [
  { crop: [0, 0, 510, 580], x: 548, y: 588, width: 160, phase: 0 },
  { crop: [512, 0, 473, 590], x: 975, y: 572, width: 180, phase: 1.7 },
  { crop: [985, 0, 551, 595], x: 895, y: 711, width: 205, phase: 3.2 },
  { crop: [0, 600, 512, 424], x: 627, y: 820, width: 132, phase: 4.4 }
];
export const WATER_POLYGONS = [
  [[431,609],[525,576],[620,550],[710,550],[778,544],[845,557],[915,570],[1030,604],[1140,640],[1206,684],[1184,720],[1112,753],[1030,788],[941,810],[907,849],[847,880],[824,858],[827,756],[740,726],[632,696],[524,672],[442,644]],
  [[394,755],[442,756],[492,781],[604,806],[721,836],[819,837],[819,873],[877,907],[831,948],[762,979],[664,982],[561,953],[466,921],[409,875],[360,833],[350,810]],
  [[1310,552],[1446,550],[1440,628],[1389,689],[1362,708],[1355,666],[1320,637]],
  [[1382,779],[1441,822],[1424,872],[1371,911],[1261,946],[1135,1000],[977,1038],[823,1080],[708,1064],[590,1022],[475,970],[339,901],[322,859],[412,903],[562,968],[715,1008],[832,1006],[978,978],[1153,937],[1305,876],[1371,826]]
];
// Water-side traces of the beach and breakwater; used for an animated surf band.
export const SHORE_PATHS = [
  [[411,759],[385,776],[359,802],[363,832],[404,865],[469,905],[560,944],[664,970],[757,972],[822,953],[858,930]],
  [[825,1019],[942,991],[1062,962],[1183,929],[1296,887],[1374,841],[1400,808]],
  [[1358,634],[1398,609],[1432,577]]
];
export const FOREGROUND_PIER = [[382,643],[827,748],[826,836],[780,824],[780,789],[708,775],[708,755],[595,729],[595,745],[547,731],[547,716],[452,693],[452,712],[409,698],[409,681],[381,676]];
const CAST_POLYGON = [[684,583],[822,578],[1030,622],[1164,670],[1168,708],[1047,765],[942,797],[859,755],[841,734],[728,703],[685,660]];

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > point.y) !== (yj > point.y) && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isCastable(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !pointInPolygon(point, CAST_POLYGON)) return false;
  // Hulls are obstacles. Their small animation stays inside these generous bounds.
  return !BOATS.some(boat => {
    const height = boat.width * boat.crop[3] / boat.crop[2];
    const hullY = boat.y + height * 0.32;
    return ((point.x - boat.x) / (boat.width * 0.54)) ** 2 + ((point.y - hullY) / (height * 0.2)) ** 2 < 1;
  });
}

export function randomCastPoint(random = Math.random) {
  for (let i = 0; i < 80; i++) {
    const point = { x: 700 + random() * 430, y: 590 + random() * 170 };
    if (isCastable(point)) return point;
  }
  return { x: 785, y: 618 };
}

// ---- Walking (feature/walking) -------------------------------------------
// Walkable ground traced over the illustration: the long pier, the upper quay with
// the cafe square, and the beach below the stairs. Map pixels, Y down.
export const WALK_POLYGONS = [
  [[390,630],[825,740],[825,795],[390,690]],
  [[205,560],[300,470],[450,445],[700,440],[1000,455],[1090,505],[1070,535],[1000,520],[880,510],[700,505],[560,520],[450,560],[410,625],[395,700],[300,705],[205,640]],
  [[300,700],[395,690],[400,760],[360,800],[380,870],[300,860],[240,780]]
];
// Simple colliders: circles {x, y, r} and rectangles {x, y, w, h}.
export const OBSTACLES = [
  { x: 200, y: 440, w: 205, h: 125 },  // Seafood Cafe
  { x: 270, y: 610, r: 38 },           // cafe tables
  { x: 362, y: 569, r: 12 },           // menu board
  { x: 450, y: 550, r: 10 },           // square lamp
  { x: 431, y: 644, r: 13 },           // barrel by the pier
  { x: 685, y: 727, r: 9 },            // pier lamp
  { x: 238, y: 775, r: 36 }            // beached boat
];
export const PLAYER_RADIUS = 7;

const inAny = (point, polygons) => polygons.some(polygon => pointInPolygon(point, polygon));
export const isWater = point => inAny(point, WATER_POLYGONS) && !inAny(point, WALK_POLYGONS);

function hitsObstacle(point, radius) {
  return OBSTACLES.some(o => o.r
    ? Math.hypot(point.x - o.x, point.y - o.y) < o.r + radius
    : point.x > o.x - radius && point.x < o.x + o.w + radius && point.y > o.y - radius && point.y < o.y + o.h + radius);
}

export function isWalkable(point, radius = PLAYER_RADIUS) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  // The feet and a small ring around them must all stand on walkable ground.
  const ring = [[0, 0], [radius, 0], [-radius, 0], [0, radius * 0.6], [0, -radius * 0.6]];
  return ring.every(([dx, dy]) => inAny({ x: point.x + dx, y: point.y + dy }, WALK_POLYGONS)) && !hitsObstacle(point, radius);
}

export function hitsBoat(point) {
  return BOATS.some(boat => {
    const height = boat.width * boat.crop[3] / boat.crop[2];
    const hullY = boat.y + height * 0.32;
    return ((point.x - boat.x) / (boat.width * 0.54)) ** 2 + ((point.y - hullY) / (height * 0.2)) ** 2 < 1;
  });
}
export const isOpenWater = point => !!point && Number.isFinite(point.x) && Number.isFinite(point.y) && isWater(point) && !hitsBoat(point);
