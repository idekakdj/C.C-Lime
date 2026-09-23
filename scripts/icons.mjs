import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFile } from 'node:fs/promises';
await sharp('assets/icon.svg').resize(256, 256).png().toFile('assets/icon.png');
await writeFile('assets/icon.ico', await pngToIco('assets/icon.png'));
