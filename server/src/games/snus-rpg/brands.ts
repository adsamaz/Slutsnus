import { SnusBrand } from '@slutsnus/shared';

export const SNUS_BRANDS: SnusBrand[] = [
    {
        id: 'general',
        name: 'General Snus',
        nicotineStrength: 4,
        taste: 'Tobacco',
        pouchSize: 'regular',
        value: 20,
    },
    {
        id: 'general-white',
        name: 'General White Portion',
        nicotineStrength: 4,
        taste: 'Tobacco/Fresh',
        pouchSize: 'slim',
        value: 22,
    },
    {
        id: 'goteborg',
        name: 'Göteborgs Rapé',
        nicotineStrength: 3,
        taste: 'Bergamot',
        pouchSize: 'regular',
        value: 18,
    },
    {
        id: 'ettan',
        name: 'Ettan',
        nicotineStrength: 3,
        taste: 'Traditional',
        pouchSize: 'regular',
        value: 17,
    },
    {
        id: 'grov',
        name: 'Grov',
        nicotineStrength: 3,
        taste: 'Earth/Tobacco',
        pouchSize: 'regular',
        value: 16,
    },
    {
        id: 'roda-lacket',
        name: 'Röda Lacket',
        nicotineStrength: 2,
        taste: 'Smoke',
        pouchSize: 'regular',
        value: 14,
    },
    {
        id: 'catch-licorice',
        name: 'Catch Licorice',
        nicotineStrength: 5,
        taste: 'Licorice',
        pouchSize: 'slim',
        value: 25,
    },
    {
        id: 'odens-extreme',
        name: "Oden's Extreme",
        nicotineStrength: 10,
        taste: 'Tobacco',
        pouchSize: 'large',
        value: 60,
    },
    {
        id: 'thunder-strong',
        name: 'Thunder Extra Strong',
        nicotineStrength: 9,
        taste: 'Pepper/Tobacco',
        pouchSize: 'large',
        value: 55,
    },
    {
        id: 'odens-cold-dry',
        name: "Oden's Cold Dry",
        nicotineStrength: 8,
        taste: 'Mint',
        pouchSize: 'slim',
        value: 48,
    },
    {
        id: 'siberia',
        name: 'Siberia -80',
        nicotineStrength: 10,
        taste: 'Mint/Menthol',
        pouchSize: 'regular',
        value: 65,
    },
    {
        id: 'knox',
        name: 'Knox Original',
        nicotineStrength: 2,
        taste: 'Traditional',
        pouchSize: 'regular',
        value: 12,
    },
];

export function getBrandById(id: string): SnusBrand | undefined {
    return SNUS_BRANDS.find((brand) => brand.id === id);
}
