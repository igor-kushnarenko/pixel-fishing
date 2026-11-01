# Графика «Тихой бухты»

Вход: пользовательская иллюстрация «Уютная бухта_ маяк и рыбацкая деревня.png», 1448 × 1086.
Подготовлено встроенным инструментом ImageGen (не CLI/API).
Исходный файл в Downloads не изменён. Все используемые игрой файлы находятся в репозитории.

- `public/art/harbor.png`: фон 1448 × 1086; четыре плавающие лодки и статичный дым удалены, вода/фон восстановлены.
- `public/art/harbor-sprites.png`: RGBA-атлас 1536 × 1024, лодки в стиле исходной карты, рыбак и дым. Альфа-канал сохранён.

Это фиксированная изометрическая иллюстрация со слоями, а не свободно вращаемая 3D-модель деревни.
Координаты масок, причала, лодок и заброса задаются в `src/harbor-map.js` в пикселях карты.
Прямоугольники спрайтов уточнены по фактическому размещению на атласе.
Фон и маски воды/переднего причала совмещены; лодки за причалом перекрываются его слоем.
Красный канал маски ограничивает площадь воды, зелёный задаёт мягкую полосу прибоя
по `SHORE_PATHS`. Проверка цвета и соседних пикселей включает узкие блики и пену,
но не допускает переноса деревянных причалов и скал в воду при смещении текстуры.
Волны, блики и прибой движутся независимо; геометрия зданий остаётся неподвижной.
Ночная тонировка, свечения и луч маяка накладываются в сцене, отдельной ночной картинки нет.

## Финальный промпт фона

```text
Use case: precise-object-edit. Asset type: clean background plate for a layered browser fishing game. Edit target: the attached harbor illustration. Preserve its original 4:3 aspect ratio and the exact composition, camera angle, shoreline, piers, all buildings, all text/signage, trees, rocks, lighthouse, lamps, white outer background, and hand-painted pixel-like detail. Make only these removals: remove the four FLOATING boats (green boat at left center, red trawler upper-right in basin, large blue trawler lower middle, tiny white/blue skiff lower-left in basin), including their masts, ropes, wakes and reflections; reconstruct uninterrupted turquoise harbor water behind them. Preserve the wooden boat resting on the sand at far left. Remove the smoke puffs above the two house/cafe chimneys, reconstructing the white background/foliage behind them. All empty water should have matching detailed teal ripples and warm reflected lantern highlights. Do not add any boats, people or other objects. Keep every dock and railing intact and in exactly the same position. This should be the same map, prepared for separately animated boats and smoke. Output high-resolution landscape 4:3.
```

## Финальный промпт атласа

```text
Use case: background-extraction and stylized game sprites. Asset type: transparent PNG sprite atlas, exactly THREE equal columns by TWO equal rows, landscape 1536x1024 (each cell 512x512). The attached image is the source and style reference. Produce exactly six isolated complete sprites, one centered in each cell with at least 36px transparent margins and nothing overlapping cell edges. Reading order: TOP LEFT the source green fishing boat with cream cabin, mast and rigging, seen in its original isometric camera angle; TOP MIDDLE the source red trawler with white cabin, mast and rigging, same angle; TOP RIGHT the source large blue trawler with cream cabin and tall rigging, same angle. BOTTOM LEFT the source small white skiff with blue lower hull and colorful fishing supplies, seen from above diagonally. BOTTOM MIDDLE a small cozy fisherman in a red sweater, navy trousers, straw-yellow hat and brown boots, standing seen isometrically from behind-left, facing diagonally lower-right; empty hands held forward to hold a fishing pole that will be drawn separately, NO fishing rod in the sprite. BOTTOM RIGHT a single soft pale cream chimney smoke puff, no chimney. Match original richly detailed illustrated/pixel-art-like style and warm lighting; preserve distinctive hull colors and vessel details. All boats must be fully visible INCLUDING all masts, rigging and hulls, on genuine transparent alpha with NO water, wake, cast shadow, docks, scenery, grid lines, labels, text or checkerboard. Keep boat sprites at consistent relative scale within their cells, occupying about 75-82 percent of their cells' maximum dimension. The fisherman can occupy 70 percent cell height.
```
