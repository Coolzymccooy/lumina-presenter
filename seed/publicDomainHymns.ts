import type {
  Hymn,
  HymnAuthor,
  HymnCopyright,
  HymnLibrarySource,
  HymnMetadataRecord,
  HymnPresentationDefaults,
  HymnSearchIndex,
  HymnSection,
  HymnThemeCategory,
  HymnTune,
  HymnUsageRights,
} from '../types/hymns.ts';

const normalizeSeedSearchText = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’']/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase();

const makeSearchIndex = (input: {
  title: string;
  alternateTitles: string[];
  firstLine: string;
  authors: HymnAuthor[];
  tunes: HymnTune[];
  themes: HymnThemeCategory[];
  scriptureThemes: string[];
  searchKeywords: string[];
}) => {
  const searchables = [
    input.title,
    ...input.alternateTitles,
    input.firstLine,
    ...input.authors.map((entry) => entry.name),
    ...input.tunes.flatMap((entry) => [entry.name, ...(entry.alternateNames || [])]),
    ...input.themes,
    ...input.scriptureThemes,
    ...input.searchKeywords,
  ].filter(Boolean);

  const tokens = Array.from(new Set(
    searchables
      .flatMap((entry) => normalizeSeedSearchText(entry).split(/\s+/))
      .filter((entry) => entry.length > 1)
  ));

  return {
    normalizedTitle: normalizeSeedSearchText(input.title),
    normalizedFirstLine: normalizeSeedSearchText(input.firstLine),
    keywords: input.searchKeywords.map((entry) => normalizeSeedSearchText(entry)),
    themes: input.themes.map((entry) => normalizeSeedSearchText(entry)),
    tokens,
    searchableText: normalizeSeedSearchText(searchables.join(' ')),
  } satisfies HymnSearchIndex;
};

const defaults = (
  theme: HymnThemeCategory,
  preset = 'classic-worship-serif',
  motion: HymnPresentationDefaults['preferredBackgroundMotion'] = 'either',
  chorusVisuallyDistinct = true,
) => ({
  defaultTypographyPresetId: preset,
  defaultThemeCategory: theme,
  defaultChorusStrategy: 'smart',
  preferredBackgroundMotion: motion,
  maxLinesPerSlide: 2,
  preferredCharsPerLine: 32,
  allowThreeLineSlides: true,
  chorusVisuallyDistinct,
} satisfies HymnPresentationDefaults);

const pdCopyright = (textAttribution: string, tuneAttribution: string, requiresReview = false, notes: string[] = []) => ({
  publicDomain: true,
  requiresReview,
  textPd: true,
  tunePd: true,
  textAttribution,
  tuneAttribution,
  publicDomainBasis: 'Historic hymn text and tune are treated as public domain for bundled Lumina content.',
  notes,
} satisfies HymnCopyright);

const bundledPublicDomainSource = (): HymnLibrarySource => ({
  kind: 'bundled-pd',
  isBundled: true,
  providerId: 'lumina-bundled',
  providerName: 'Lumina Bundled Hymns',
  catalogId: 'built-in-public-domain-hymns',
  displayLabel: 'Bundled Hymn',
});

const bundledPublicDomainRights = (): HymnUsageRights => ({
  licenseScope: 'bundled-distribution',
  canStoreText: true,
  canDistributeInApp: true,
  canProject: true,
  canStream: true,
  requiresAttribution: false,
  requiresLicenseCheck: false,
  notice: 'Bundled with Lumina as verified public-domain hymn content.',
});

const A = (name: string, role: HymnAuthor['role'], notes?: string): HymnAuthor => ({
  name,
  role,
  ...(notes ? { notes } : {}),
});

const T = (name: string, composer?: string, meter?: string, alternateNames?: string[]): HymnTune => ({
  name,
  publicDomain: true,
  ...(composer ? { composer } : {}),
  ...(meter ? { meter } : {}),
  ...(alternateNames?.length ? { alternateNames } : {}),
});

const S = (
  id: string,
  type: HymnSection['type'],
  label: string,
  order: number,
  text: string,
  presentation?: HymnSection['presentation'],
): HymnSection => ({
  id,
  type,
  label,
  order,
  text: text.trim(),
  ...(presentation ? { presentation } : {}),
});

const hymn = (input: Omit<Hymn, 'searchIndex' | 'librarySource' | 'usageRights'> & Partial<Pick<Hymn, 'librarySource' | 'usageRights'>>): Hymn => ({
  ...input,
  librarySource: input.librarySource || bundledPublicDomainSource(),
  usageRights: input.usageRights || bundledPublicDomainRights(),
  searchIndex: makeSearchIndex(input),
});

export const PUBLIC_DOMAIN_HYMNS: Hymn[] = [
  hymn({
    id: 'amazing-grace',
    title: 'Amazing Grace',
    alternateTitles: ['Amazing Grace! How Sweet the Sound'],
    firstLine: 'Amazing grace! how sweet the sound',
    meter: 'CM',
    authors: [A('John Newton', 'text'), A('Traditional American melody', 'tune', 'Commonly sung to NEW BRITAIN.')],
    tunes: [T('NEW BRITAIN', undefined, 'CM')],
    themes: ['grace', 'assurance', 'comfort'],
    scriptureThemes: ['Ephesians 2:8-9', 'Luke 15:24', 'John 9:25'],
    copyright: pdCopyright('Text: John Newton.', 'Tune: NEW BRITAIN, public-domain American melody.'),
    searchKeywords: ['grace', 'salvation', 'testimony', 'mercy'],
    presentationDefaults: defaults('grace', 'classic-worship-serif', 'either', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Amazing grace! how sweet the sound,
That saved a wretch like me!
I once was lost, but now am found;
Was blind, but now I see.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
'Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Through many dangers, toils, and snares,
I have already come;
'Tis grace hath brought me safe thus far,
And grace will lead me home.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
The Lord has promised good to me,
His word my hope secures;
He will my shield and portion be
As long as life endures.
      `),
      S('v5', 'verse', 'Verse 5', 5, `
When we've been there ten thousand years,
Bright shining as the sun,
We've no less days to sing God's praise
Than when we first begun.
      `),
    ],
  }),
  hymn({
    id: 'a-mighty-fortress-is-our-god',
    title: 'A Mighty Fortress Is Our God',
    alternateTitles: ['Ein feste Burg ist unser Gott'],
    firstLine: 'A mighty Fortress is our God',
    meter: '87.87.55.56.7',
    authors: [A('Martin Luther', 'text'), A('Martin Luther', 'tune')],
    tunes: [T('EIN FESTE BURG', 'Martin Luther', '87.87.55.56.7')],
    themes: ['victory', 'majesty', 'assurance'],
    scriptureThemes: ['Psalm 46', 'Ephesians 6:10-18', 'Romans 8:31'],
    copyright: pdCopyright('Text: Martin Luther.', 'Tune: EIN FESTE BURG by Martin Luther.'),
    searchKeywords: ['victory', 'church', 'confidence', 'fortress'],
    presentationDefaults: defaults('victory', 'choir-hymnal', 'either', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
A mighty Fortress is our God,
A Bulwark never failing;
Our Helper He amid the flood
Of mortal ills prevailing:
For still our ancient foe
Doth seek to work us woe;
His craft and power are great,
And, armed with cruel hate,
On earth is not his equal.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Did we in our own strength confide,
Our striving would be losing;
Were not the right Man on our side,
The Man of God's own choosing:
Dost ask who that may be?
Christ Jesus, it is He;
Lord Sabaoth His Name,
From age to age the same,
And He must win the battle.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
And though this world, with devils filled,
Should threaten to undo us,
We will not fear, for God hath willed
His truth to triumph through us:
The Prince of Darkness grim,
We tremble not for him;
His rage we can endure,
For lo! his doom is sure,
One little word shall fell him.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
That Word above all earthly powers,
No thanks to them, abideth;
The Spirit and the gifts are ours
Through Him Who with us sideth:
Let goods and kindred go,
This mortal life also;
The body they may kill:
God's truth abideth still,
His kingdom is forever.
      `),
    ],
  }),
  hymn({
    id: 'all-hail-the-power-of-jesus-name',
    title: 'All Hail the Power of Jesus’ Name',
    alternateTitles: ["All Hail the Power of Jesus' Name"],
    firstLine: 'All hail the power of Jesus’ Name!',
    meter: 'CM',
    authors: [A('Edward Perronet', 'text'), A('John Rippon tradition', 'attribution'), A('Oliver Holden', 'tune')],
    tunes: [T('CORONATION', 'Oliver Holden', 'CM'), T('DIADEM', 'James Ellor', 'CM')],
    themes: ['majesty', 'praise', 'victory'],
    scriptureThemes: ['Philippians 2:9-11', 'Revelation 19:12', 'Hebrews 1:6'],
    copyright: pdCopyright('Text: Edward Perronet / John Rippon tradition.', 'Tunes: CORONATION / DIADEM, public domain.'),
    searchKeywords: ['kingship', 'worship', 'exaltation', 'crown'],
    presentationDefaults: defaults('majesty', 'classic-worship-serif', 'motion', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
All hail the power of Jesus' Name!
Let angels prostrate fall;
Bring forth the royal diadem,
And crown Him Lord of all;
Bring forth the royal diadem,
And crown Him Lord of all.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Ye chosen seed of Israel's race,
Ye ransomed from the fall,
Hail Him Who saves you by His grace,
And crown Him Lord of all;
Hail Him Who saves you by His grace,
And crown Him Lord of all.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Let every kindred, every tribe,
On this terrestrial ball,
To Him all majesty ascribe,
And crown Him Lord of all;
To Him all majesty ascribe,
And crown Him Lord of all.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
O that with yonder sacred throng
We at His feet may fall!
We'll join the everlasting song,
And crown Him Lord of all;
We'll join the everlasting song,
And crown Him Lord of all.
      `),
    ],
  }),
  hymn({
    id: 'all-creatures-of-our-god-and-king',
    title: 'All Creatures of Our God and King',
    alternateTitles: ['Ye Watchers and Ye Holy Ones'],
    firstLine: 'All creatures of our God and King',
    meter: '77.77 with refrain',
    authors: [A('Francis of Assisi source', 'text'), A('W. H. Draper', 'paraphrase')],
    tunes: [T('LASST UNS ERFREUEN', undefined, '77.77 with refrain')],
    themes: ['creation', 'praise', 'thanksgiving'],
    scriptureThemes: ['Psalm 148', 'Daniel 3:57-88', 'Revelation 5:13'],
    copyright: pdCopyright('Text source: Francis of Assisi / paraphrase by W. H. Draper.', 'Tune: LASST UNS ERFREUEN.'),
    searchKeywords: ['creation', 'praise', 'joyful', 'alleluia'],
    presentationDefaults: defaults('creation', 'modern-clean-sans', 'motion', true),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
All creatures of our God and King,
Lift up your voice and with us sing,
Alleluia! Alleluia!
Thou burning sun with golden beam,
Thou silver moon with softer gleam,
      `),
      S('chorus', 'chorus', 'Chorus', 2, `
O praise Him! O praise Him!
Alleluia! Alleluia! Alleluia!
      `, {
        repeatMode: 'each-verse',
        repeatAfterSectionTypes: ['verse'],
        visuallyDistinct: true,
      }),
      S('v2', 'verse', 'Verse 2', 3, `
Thou rushing wind that art so strong,
Ye clouds that sail in heaven along,
Alleluia! Alleluia!
Thou rising morn, in praise rejoice,
Ye lights of evening, find a voice,
      `),
      S('v3', 'verse', 'Verse 3', 4, `
Thou flowing water, pure and clear,
Make music for thy Lord to hear,
Alleluia! Alleluia!
Thou fire so masterful and bright,
That givest man both warmth and light,
      `),
      S('v4', 'verse', 'Verse 4', 5, `
And all ye men of tender heart,
Forgiving others, take your part,
Alleluia! Alleluia!
Ye who long pain and sorrow bear,
Praise God and on Him cast your care,
      `),
      S('v5', 'verse', 'Verse 5', 6, `
Let all things their Creator bless,
And worship Him in humbleness,
Alleluia! Alleluia!
Praise, praise the Father, praise the Son,
And praise the Spirit, Three in One,
      `),
    ],
  }),
  hymn({
    id: 'abide-with-me',
    title: 'Abide with Me',
    alternateTitles: ['Eventide'],
    firstLine: 'Abide with me; fast falls the eventide',
    meter: '10.10.10.10',
    authors: [A('Henry F. Lyte', 'text'), A('William H. Monk', 'tune')],
    tunes: [T('EVENTIDE', 'William H. Monk', '10.10.10.10')],
    themes: ['comfort', 'prayer', 'reflection'],
    scriptureThemes: ['Luke 24:29', 'Psalm 23:4', 'John 14:18'],
    copyright: pdCopyright('Text: Henry F. Lyte.', 'Tune: EVENTIDE by William H. Monk.'),
    searchKeywords: ['comfort', 'evening', 'prayer', 'presence'],
    presentationDefaults: defaults('comfort', 'classic-worship-serif', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Abide with me; fast falls the eventide;
The darkness deepens; Lord, with me abide.
When other helpers fail and comforts flee,
Help of the helpless, O abide with me.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Swift to its close ebbs out life's little day;
Earth's joys grow dim, its glories pass away;
Change and decay in all around I see;
O Thou Who changest not, abide with me.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
I need Thy presence every passing hour;
What but Thy grace can foil the tempter's power?
Who, like Thyself, my guide and stay can be?
Through cloud and sunshine, O abide with me.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
Hold Thou Thy cross before my closing eyes;
Shine through the gloom and point me to the skies;
Heaven's morning breaks, and earth's vain shadows flee;
In life, in death, O Lord, abide with me.
      `),
    ],
  }),
  hymn({
    id: 'blessed-assurance',
    title: 'Blessed Assurance',
    alternateTitles: [],
    firstLine: 'Blessed assurance, Jesus is mine!',
    meter: '9.10.9.9 with refrain',
    authors: [A('Fanny J. Crosby', 'text'), A('Phoebe P. Knapp', 'tune')],
    tunes: [T('ASSURANCE', 'Phoebe P. Knapp', undefined, ['Blessed Assurance'])],
    themes: ['assurance', 'praise', 'grace'],
    scriptureThemes: ['Hebrews 10:22', 'Romans 8:16', '1 Peter 1:3-4'],
    copyright: pdCopyright('Text: Fanny J. Crosby.', 'Tune: Phoebe P. Knapp.'),
    searchKeywords: ['assurance', 'testimony', 'joy', 'story'],
    presentationDefaults: defaults('assurance', 'modern-clean-sans', 'either', true),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Blessed assurance, Jesus is mine!
O what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.
      `),
      S('chorus', 'chorus', 'Chorus', 2, `
This is my story, this is my song,
Praising my Savior all the day long;
This is my story, this is my song,
Praising my Savior all the day long.
      `, {
        repeatMode: 'each-verse',
        repeatAfterSectionTypes: ['verse'],
        visuallyDistinct: true,
      }),
      S('v2', 'verse', 'Verse 2', 3, `
Perfect submission, perfect delight,
Visions of rapture now burst on my sight;
Angels descending bring from above
Echoes of mercy, whispers of love.
      `),
      S('v3', 'verse', 'Verse 3', 4, `
Perfect submission, all is at rest,
I in my Savior am happy and blest;
Watching and waiting, looking above,
Filled with His goodness, lost in His love.
      `),
    ],
  }),
  hymn({
    id: 'blest-be-the-tie-that-binds',
    title: 'Blest Be the Tie That Binds',
    alternateTitles: ['Blessed Be the Tie That Binds'],
    firstLine: 'Blest be the tie that binds',
    meter: 'CM',
    authors: [A('John Fawcett', 'text'), A('Johann G. Nageli', 'tune')],
    tunes: [T('DENNIS', 'Johann G. Nageli', 'CM')],
    themes: ['communion', 'thanksgiving', 'comfort'],
    scriptureThemes: ['Romans 12:10', 'Ephesians 4:3', 'Philippians 2:1-2'],
    copyright: pdCopyright('Text: John Fawcett.', 'Tune: DENNIS.'),
    searchKeywords: ['fellowship', 'church', 'unity', 'love'],
    presentationDefaults: defaults('communion', 'choir-hymnal', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Blest be the tie that binds
Our hearts in Christian love;
The fellowship of kindred minds
Is like to that above.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Before our Father's throne
We pour our ardent prayers;
Our fears, our hopes, our aims are one,
Our comforts and our cares.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
We share our mutual woes,
Our mutual burdens bear;
And often for each other flows
The sympathizing tear.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
When we asunder part,
It gives us inward pain;
But we shall still be joined in heart,
And hope to meet again.
      `),
    ],
  }),
  hymn({
    id: 'come-thou-almighty-king',
    title: 'Come, Thou Almighty King',
    alternateTitles: ['Italian Hymn'],
    firstLine: 'Come, Thou Almighty King',
    meter: '64.64.66.66',
    authors: [A('Traditional public-domain hymn text', 'text', 'Historic attribution is debated.'), A('Felice de Giardini', 'tune')],
    tunes: [T('ITALIAN HYMN', 'Felice de Giardini', '64.64.66.66', ['MOSCOW'])],
    themes: ['majesty', 'praise', 'holiness'],
    scriptureThemes: ['Isaiah 6:3', 'Matthew 28:19', '2 Corinthians 13:14'],
    copyright: pdCopyright('Text: traditional public-domain hymn text.', 'Tune: ITALIAN HYMN / MOSCOW by Felice de Giardini.', true, ['Text attribution remains flagged for review.']),
    searchKeywords: ['trinity', 'invocation', 'opening', 'almighty'],
    presentationDefaults: defaults('majesty', 'classic-worship-serif', 'either', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Come, Thou Almighty King,
Help us Thy Name to sing,
Help us to praise!
Father all glorious,
O'er all victorious,
Come and reign over us,
Ancient of Days!
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Come, Thou Incarnate Word,
Gird on Thy mighty sword,
Our prayer attend!
Come, and Thy people bless,
And give Thy Word success;
Spirit of holiness,
On us descend!
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Come, Holy Comforter,
Thy sacred witness bear
In this glad hour!
Thou, who almighty art,
Now rule in every heart,
And ne'er from us depart,
Spirit of power!
      `),
      S('v4', 'verse', 'Verse 4', 4, `
To Thee, great One in Three,
The highest praises be,
Hence evermore!
Thy sovereign majesty
May we in glory see,
And to eternity
Love and adore!
      `),
    ],
  }),
  hymn({
    id: 'crown-him-with-many-crowns',
    title: 'Crown Him with Many Crowns',
    alternateTitles: [],
    firstLine: 'Crown Him with many crowns',
    meter: '6.6.8.6',
    authors: [A('Matthew Bridges', 'text'), A('Godfrey Thring variants', 'attribution'), A('George J. Elvey', 'tune')],
    tunes: [T('DIADEMATA', 'George J. Elvey', '6.6.8.6')],
    themes: ['majesty', 'praise', 'victory'],
    scriptureThemes: ['Revelation 19:12', 'Hebrews 2:9', 'Acts 1:9'],
    copyright: pdCopyright('Text: Matthew Bridges / Godfrey Thring variants.', 'Tune: DIADEMATA by George J. Elvey.', true, ['Multiple public-domain stanza variants exist.']),
    searchKeywords: ['christ', 'majesty', 'ascension', 'crown'],
    presentationDefaults: defaults('majesty', 'classic-worship-serif', 'motion', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Crown Him with many crowns,
The Lamb upon His throne;
Hark! how the heavenly anthem drowns
All music but its own.
Awake, my soul, and sing
Of Him Who died for thee,
And hail Him as thy matchless King
Through all eternity.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Crown Him the Lord of life,
Who triumphed o'er the grave,
And rose victorious in the strife
For those He came to save;
His glories now we sing
Who died and rose on high,
Who died, eternal life to bring,
And lives that death may die.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Crown Him the Lord of peace,
Whose power a scepter sways
From pole to pole, that wars may cease,
Absorbed in prayer and praise;
His reign shall know no end,
And round His pierced feet
Fair flowers of paradise extend
Their fragrance ever sweet.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
Crown Him the Lord of heaven,
One with the Father known,
One with the Spirit through Him given
From yonder glorious throne;
To Thee be endless praise,
For Thou for us hast died;
Be Thou, O Lord, through endless days
Adored and magnified.
      `),
    ],
  }),
  hymn({
    id: 'faith-of-our-fathers',
    title: 'Faith of Our Fathers',
    alternateTitles: [],
    firstLine: 'Faith of our fathers! living still',
    meter: '86.86 with refrain',
    authors: [A('Frederick W. Faber', 'text'), A('Henri F. Hemy', 'tune')],
    tunes: [T('ST. CATHERINE', 'Henri F. Hemy')],
    themes: ['victory', 'assurance', 'mission'],
    scriptureThemes: ['Hebrews 12:1', '2 Timothy 1:5', 'Jude 3'],
    copyright: pdCopyright('Text: Frederick W. Faber.', 'Tune: ST. CATHERINE.'),
    searchKeywords: ['faithfulness', 'heritage', 'courage', 'martyrs'],
    presentationDefaults: defaults('victory', 'choir-hymnal', 'either', true),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Faith of our fathers! living still
In spite of dungeon, fire, and sword;
O how our hearts beat high with joy
Whene'er we hear that glorious Word!
      `),
      S('refrain', 'refrain', 'Refrain', 2, `
Faith of our fathers, holy faith!
We will be true to thee till death!
      `, {
        repeatMode: 'each-verse',
        repeatAfterSectionTypes: ['verse'],
        visuallyDistinct: true,
      }),
      S('v2', 'verse', 'Verse 2', 3, `
Our fathers, chained in prisons dark,
Were still in heart and conscience free;
How sweet would be their children's fate,
If they, like them, could die for thee!
      `),
      S('v3', 'verse', 'Verse 3', 4, `
Faith of our fathers! we will love
Both friend and foe in all our strife;
And preach thee, too, as love knows how,
By kindly words and virtuous life.
      `),
    ],
  }),
  hymn({
    id: 'for-the-beauty-of-the-earth',
    title: 'For the Beauty of the Earth',
    alternateTitles: [],
    firstLine: 'For the beauty of the earth',
    meter: '7.7.7.7.7.7',
    authors: [A('Folliott S. Pierpoint', 'text'), A('Conrad Kocher', 'tune')],
    tunes: [T('DIX', 'Conrad Kocher')],
    themes: ['thanksgiving', 'creation', 'praise'],
    scriptureThemes: ['Genesis 1:31', 'James 1:17', 'Psalm 136:1'],
    copyright: pdCopyright('Text: Folliott S. Pierpoint.', 'Tune: DIX by Conrad Kocher.'),
    searchKeywords: ['thanksgiving', 'creation', 'offering', 'gratitude'],
    presentationDefaults: defaults('thanksgiving', 'modern-clean-sans', 'either', true),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
For the beauty of the earth,
For the glory of the skies,
For the love which from our birth
Over and around us lies,
      `),
      S('refrain', 'refrain', 'Refrain', 2, `
Lord of all, to Thee we raise
This our hymn of grateful praise.
      `, {
        repeatMode: 'each-verse',
        repeatAfterSectionTypes: ['verse'],
        visuallyDistinct: true,
      }),
      S('v2', 'verse', 'Verse 2', 3, `
For the beauty of each hour
Of the day and of the night,
Hill and vale, and tree and flower,
Sun and moon and stars of light,
      `),
      S('v3', 'verse', 'Verse 3', 4, `
For the joy of human love,
Brother, sister, parent, child,
Friends on earth and friends above,
For all gentle thoughts and mild,
      `),
      S('v4', 'verse', 'Verse 4', 5, `
For Thy Church that evermore
Lifteth holy hands above,
Offering up on every shore
Her pure sacrifice of love,
      `),
      S('v5', 'verse', 'Verse 5', 6, `
For Thyself, best Gift Divine!
To our race so freely given,
For that great, great love of Thine,
Peace on earth, and joy in heaven,
      `),
    ],
  }),
  hymn({
    id: 'guide-me-o-thou-great-jehovah',
    title: 'Guide Me, O Thou Great Jehovah',
    alternateTitles: ['Guide Me, O Thou Great Redeemer'],
    firstLine: 'Guide me, O Thou great Jehovah',
    meter: '8.7.8.7.4.7',
    authors: [A('William Williams', 'text'), A('Peter Williams tradition', 'translator'), A('John Hughes', 'tune')],
    tunes: [T('CWM RHONDDA', 'John Hughes')],
    themes: ['guidance', 'victory', 'assurance'],
    scriptureThemes: ['Exodus 13:21', 'John 6:35', 'Joshua 3:17'],
    copyright: pdCopyright('Text: William Williams / English by Peter Williams tradition.', 'Tune: CWM RHONDDA by John Hughes.'),
    searchKeywords: ['guidance', 'pilgrimage', 'strength', 'bread of heaven'],
    presentationDefaults: defaults('guidance', 'big-hall-readability', 'motion', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Guide me, O Thou great Jehovah,
Pilgrim through this barren land;
I am weak, but Thou art mighty;
Hold me with Thy powerful hand;
Bread of heaven,
Feed me till I want no more;
Bread of heaven,
Feed me till I want no more.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Open now the crystal fountain,
Whence the healing stream doth flow;
Let the fire and cloudy pillar
Lead me all my journey through;
Strong Deliverer,
Be Thou still my Strength and Shield;
Strong Deliverer,
Be Thou still my Strength and Shield.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
When I tread the verge of Jordan,
Bid my anxious fears subside;
Death of death, and hell's destruction,
Land me safe on Canaan's side;
Songs of praises,
I will ever give to Thee;
Songs of praises,
I will ever give to Thee.
      `),
    ],
  }),
  hymn({
    id: 'holy-holy-holy-lord-god-almighty',
    title: 'Holy, Holy, Holy! Lord God Almighty',
    alternateTitles: ['Nicaea'],
    firstLine: 'Holy, holy, holy! Lord God Almighty!',
    meter: '11.12.12.10',
    authors: [A('Reginald Heber', 'text'), A('John B. Dykes', 'tune')],
    tunes: [T('NICAEA', 'John B. Dykes')],
    themes: ['holiness', 'majesty', 'praise'],
    scriptureThemes: ['Isaiah 6:3', 'Revelation 4:8', 'Psalm 99:9'],
    copyright: pdCopyright('Text: Reginald Heber.', 'Tune: NICAEA by John B. Dykes.'),
    searchKeywords: ['holiness', 'trinity', 'adoration', 'holy'],
    presentationDefaults: defaults('holiness', 'classic-worship-serif', 'motion', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Holy, holy, holy! Lord God Almighty!
Early in the morning our song shall rise to Thee;
Holy, holy, holy! merciful and mighty!
God in three Persons, blessed Trinity!
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Holy, holy, holy! all the saints adore Thee,
Casting down their golden crowns around the glassy sea;
Cherubim and seraphim falling down before Thee,
Who wert, and art, and evermore shalt be.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Holy, holy, holy! though the darkness hide Thee,
Though the eye of sinful man Thy glory may not see,
Only Thou art holy; there is none beside Thee,
Perfect in power, in love, and purity.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
Holy, holy, holy! Lord God Almighty!
All Thy works shall praise Thy Name, in earth and sky and sea;
Holy, holy, holy! merciful and mighty!
God in three Persons, blessed Trinity!
      `),
    ],
  }),
  hymn({
    id: 'i-need-thee-every-hour',
    title: 'I Need Thee Every Hour',
    alternateTitles: [],
    firstLine: 'I need Thee every hour',
    meter: '10.10.10.10 with refrain',
    authors: [A('Annie S. Hawks', 'text'), A('Robert Lowry', 'tune')],
    tunes: [T('NEED', 'Robert Lowry')],
    themes: ['prayer', 'guidance', 'assurance'],
    scriptureThemes: ['John 15:5', 'Psalm 73:23-24', 'Hebrews 4:16'],
    copyright: pdCopyright('Text: Annie S. Hawks.', 'Tune: Robert Lowry.'),
    searchKeywords: ['dependence', 'prayer', 'devotion', 'need thee'],
    presentationDefaults: defaults('prayer', 'big-hall-readability', 'still', true),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
I need Thee every hour,
Most gracious Lord;
No tender voice like Thine
Can peace afford.
      `),
      S('chorus', 'chorus', 'Chorus', 2, `
I need Thee, O I need Thee;
Every hour I need Thee;
O bless me now, my Savior,
I come to Thee.
      `, {
        repeatMode: 'each-verse',
        repeatAfterSectionTypes: ['verse'],
        visuallyDistinct: true,
      }),
      S('v2', 'verse', 'Verse 2', 3, `
I need Thee every hour,
Stay Thou near by;
Temptations lose their power
When Thou art nigh.
      `),
      S('v3', 'verse', 'Verse 3', 4, `
I need Thee every hour,
In joy or pain;
Come quickly and abide,
Or life is vain.
      `),
      S('v4', 'verse', 'Verse 4', 5, `
I need Thee every hour,
Teach me Thy will;
And Thy rich promises
In me fulfill.
      `),
    ],
  }),
  hymn({
    id: 'it-is-well-with-my-soul',
    title: 'It Is Well with My Soul',
    alternateTitles: [],
    firstLine: 'When peace like a river attendeth my way',
    meter: '11.8.11.9 with refrain',
    authors: [A('Horatio G. Spafford', 'text'), A('Philip P. Bliss', 'tune')],
    tunes: [T('VILLE DU HAVRE', 'Philip P. Bliss')],
    themes: ['comfort', 'assurance', 'grace'],
    scriptureThemes: ['Philippians 4:7', 'Job 1:21', 'Psalm 46:1-2'],
    copyright: pdCopyright('Text: Horatio G. Spafford.', 'Tune: VILLE DU HAVRE by Philip P. Bliss.'),
    searchKeywords: ['peace', 'trust', 'suffering', 'hope', 'it is well'],
    presentationDefaults: defaults('comfort', 'classic-worship-serif', 'either', true),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
When peace like a river attendeth my way,
When sorrows like sea billows roll;
Whatever my lot, Thou hast taught me to say,
It is well, it is well, with my soul.
      `),
      S('chorus', 'chorus', 'Chorus', 2, `
It is well with my soul;
It is well, it is well, with my soul.
      `, {
        repeatMode: 'each-verse',
        repeatAfterSectionTypes: ['verse'],
        visuallyDistinct: true,
      }),
      S('v2', 'verse', 'Verse 2', 3, `
Though Satan should buffet, though trials should come,
Let this blest assurance control,
That Christ hath regarded my helpless estate,
And hath shed His own blood for my soul.
      `),
      S('v3', 'verse', 'Verse 3', 4, `
My sin, O the bliss of this glorious thought!
My sin, not in part but the whole,
Is nailed to the cross, and I bear it no more,
Praise the Lord, praise the Lord, O my soul!
      `),
      S('v4', 'verse', 'Verse 4', 5, `
And, Lord, haste the day when my faith shall be sight,
The clouds be rolled back as a scroll;
The trump shall resound, and the Lord shall descend,
Even so, it is well with my soul.
      `),
    ],
  }),
  hymn({
    id: 'jesus-lover-of-my-soul',
    title: 'Jesus, Lover of My Soul',
    alternateTitles: [],
    firstLine: 'Jesus, Lover of my soul',
    meter: '7.7.7.7',
    authors: [A('Charles Wesley', 'text'), A('Joseph Parry', 'tune', 'Common tune ABERYSTWYTH.')],
    tunes: [T('ABERYSTWYTH', 'Joseph Parry'), T('MARTYN', 'Simeon B. Marsh')],
    themes: ['prayer', 'comfort', 'grace'],
    scriptureThemes: ['Psalm 57:1', 'Hebrews 6:19', 'Matthew 11:28'],
    copyright: pdCopyright('Text: Charles Wesley.', 'Tunes: ABERYSTWYTH / MARTYN, public domain.'),
    searchKeywords: ['refuge', 'prayer', 'mercy', 'shelter'],
    presentationDefaults: defaults('prayer', 'classic-worship-serif', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Jesus, Lover of my soul,
Let me to Thy bosom fly,
While the nearer waters roll,
While the tempest still is high;
Hide me, O my Savior, hide,
Till the storm of life is past;
Safe into the haven guide;
O receive my soul at last.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Other refuge have I none;
Hangs my helpless soul on Thee;
Leave, ah! leave me not alone,
Still support and comfort me;
All my trust on Thee is stayed,
All my help from Thee I bring;
Cover my defenseless head
With the shadow of Thy wing.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Thou, O Christ, art all I want;
More than all in Thee I find;
Raise the fallen, cheer the faint,
Heal the sick, and lead the blind;
Just and holy is Thy Name,
I am all unrighteousness;
False and full of sin I am,
Thou art full of truth and grace.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
Plenteous grace with Thee is found,
Grace to cover all my sin;
Let the healing streams abound;
Make and keep me pure within;
Thou of life the Fountain art,
Freely let me take of Thee;
Spring Thou up within my heart,
Rise to all eternity.
      `),
    ],
  }),
  hymn({
    id: 'lead-kindly-light',
    title: 'Lead, Kindly Light',
    alternateTitles: [],
    firstLine: 'Lead, Kindly Light, amid the encircling gloom',
    meter: '10.4.10.4.10.10',
    authors: [A('John Henry Newman', 'text'), A('John B. Dykes', 'tune')],
    tunes: [T('SANDON', 'John B. Dykes')],
    themes: ['guidance', 'reflection', 'comfort'],
    scriptureThemes: ['Psalm 43:3', 'Psalm 119:105', 'John 8:12'],
    copyright: pdCopyright('Text: John Henry Newman.', 'Tune: SANDON by John B. Dykes.'),
    searchKeywords: ['guidance', 'darkness', 'trust', 'light'],
    presentationDefaults: defaults('guidance', 'classic-worship-serif', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Lead, Kindly Light, amid the encircling gloom,
Lead Thou me on!
The night is dark, and I am far from home,
Lead Thou me on!
Keep Thou my feet; I do not ask to see
The distant scene; one step enough for me.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
I was not ever thus, nor prayed that Thou
Shouldst lead me on;
I loved to choose and see my path; but now
Lead Thou me on!
I loved the garish day, and, spite of fears,
Pride ruled my will. Remember not past years.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
So long Thy power hath blest me, sure it still
Will lead me on
O'er moor and fen, o'er crag and torrent, till
The night is gone,
And with the morn those angel faces smile,
Which I have loved long since, and lost awhile.
      `),
    ],
  }),
  hymn({
    id: 'nearer-my-god-to-thee',
    title: 'Nearer, My God, to Thee',
    alternateTitles: [],
    firstLine: 'Nearer, my God, to Thee',
    meter: '6.6.8.6',
    authors: [A('Sarah Flower Adams', 'text'), A('Lowell Mason', 'tune')],
    tunes: [T('BETHANY', 'Lowell Mason')],
    themes: ['surrender', 'comfort', 'guidance'],
    scriptureThemes: ['Genesis 28:12', 'Psalm 73:28', 'Philippians 1:21'],
    copyright: pdCopyright('Text: Sarah Flower Adams.', 'Tune: BETHANY by Lowell Mason.'),
    searchKeywords: ['surrender', 'longing', 'devotion', 'nearer'],
    presentationDefaults: defaults('surrender', 'classic-worship-serif', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Nearer, my God, to Thee,
Nearer to Thee!
E'en though it be a cross
That raiseth me;
Still all my song shall be,
Nearer, my God, to Thee,
Nearer, my God, to Thee,
Nearer to Thee!
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Though like the wanderer,
The sun gone down,
Darkness be over me,
My rest a stone;
Yet in my dreams I'd be
Nearer, my God, to Thee,
Nearer, my God, to Thee,
Nearer to Thee!
      `),
      S('v3', 'verse', 'Verse 3', 3, `
There let the way appear
Steps unto heaven;
All that Thou sendest me,
In mercy given;
Angels to beckon me
Nearer, my God, to Thee,
Nearer, my God, to Thee,
Nearer to Thee!
      `),
      S('v4', 'verse', 'Verse 4', 4, `
Then with my waking thoughts
Bright with Thy praise,
Out of my stony griefs
Bethel I'll raise;
So by my woes to be
Nearer, my God, to Thee,
Nearer, my God, to Thee,
Nearer to Thee!
      `),
      S('v5', 'verse', 'Verse 5', 5, `
Or if on joyful wing,
Cleaving the sky,
Sun, moon, and stars forgot,
Upward I fly,
Still all my song shall be,
Nearer, my God, to Thee,
Nearer, my God, to Thee,
Nearer to Thee!
      `),
    ],
  }),
  hymn({
    id: 'now-thank-we-all-our-god',
    title: 'Now Thank We All Our God',
    alternateTitles: ['Nun Danket Alle Gott'],
    firstLine: 'Now thank we all our God',
    meter: '67.67.66.66',
    authors: [A('Martin Rinkart', 'text'), A('Catherine Winkworth', 'translator'), A('Johann Cruger', 'tune')],
    tunes: [T('NUN DANKET', 'Johann Cruger')],
    themes: ['thanksgiving', 'praise', 'assurance'],
    scriptureThemes: ['1 Chronicles 16:34', 'Psalm 118:1', 'James 1:17'],
    copyright: pdCopyright('Text: Martin Rinkart / English by Catherine Winkworth.', 'Tune: NUN DANKET by Johann Cruger.'),
    searchKeywords: ['thanksgiving', 'gratitude', 'blessing', 'thanks'],
    presentationDefaults: defaults('thanksgiving', 'choir-hymnal', 'either', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Now thank we all our God,
With heart and hands and voices,
Who wondrous things hath done,
In Whom His world rejoices;
Who from our mothers' arms
Hath blessed us on our way
With countless gifts of love,
And still is ours today.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
O may this bounteous God
Through all our life be near us,
With ever joyful hearts
And blessed peace to cheer us;
And keep us in His grace,
And guide us when perplexed,
And free us from all ills
In this world and the next.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
All praise and thanks to God
The Father now be given,
The Son, and Him Who reigns
With them in highest heaven,
The one eternal God,
Whom earth and heaven adore;
For thus it was, is now,
And shall be evermore.
      `),
    ],
  }),
  hymn({
    id: 'o-god-our-help-in-ages-past',
    title: 'O God, Our Help in Ages Past',
    alternateTitles: ['St. Anne'],
    firstLine: 'O God, our help in ages past',
    meter: 'CM',
    authors: [A('Isaac Watts', 'text'), A('William Croft', 'tune')],
    tunes: [T('ST. ANNE', 'William Croft', 'CM')],
    themes: ['comfort', 'assurance', 'guidance'],
    scriptureThemes: ['Psalm 90', 'Hebrews 13:8', 'Deuteronomy 33:27'],
    copyright: pdCopyright('Text: Isaac Watts.', 'Tune: ST. ANNE by William Croft.'),
    searchKeywords: ['trust', 'eternity', 'protection', 'shelter'],
    presentationDefaults: defaults('comfort', 'choir-hymnal', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
O God, our help in ages past,
Our hope for years to come,
Our shelter from the stormy blast,
And our eternal home.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Under the shadow of Thy throne
Thy saints have dwelt secure;
Sufficient is Thine arm alone,
And our defense is sure.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Before the hills in order stood,
Or earth received her frame,
From everlasting Thou art God,
To endless years the same.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
A thousand ages in Thy sight
Are like an evening gone;
Short as the watch that ends the night
Before the rising sun.
      `),
      S('v5', 'verse', 'Verse 5', 5, `
Time, like an ever-rolling stream,
Bears all its sons away;
They fly forgotten, as a dream
Dies at the opening day.
      `),
      S('v6', 'verse', 'Verse 6', 6, `
O God, our help in ages past,
Our hope for years to come,
Be Thou our guide while life shall last,
And our eternal home.
      `),
    ],
  }),
  hymn({
    id: 'onward-christian-soldiers',
    title: 'Onward, Christian Soldiers',
    alternateTitles: [],
    firstLine: 'Onward, Christian soldiers, marching as to war',
    meter: '6.5.6.5 with refrain',
    authors: [A('Sabine Baring-Gould', 'text'), A('Arthur S. Sullivan', 'tune')],
    tunes: [T('ST. GERTRUDE', 'Arthur S. Sullivan')],
    themes: ['mission', 'victory', 'majesty'],
    scriptureThemes: ['2 Timothy 2:3', 'Ephesians 6:13', '1 Corinthians 16:13'],
    copyright: pdCopyright('Text: Sabine Baring-Gould.', 'Tune: ST. GERTRUDE by Arthur S. Sullivan.'),
    searchKeywords: ['mission', 'courage', 'march', 'battle'],
    presentationDefaults: defaults('mission', 'big-hall-readability', 'motion', true),
    sections: [
      S('chorus', 'chorus', 'Chorus', 1, `
Onward, Christian soldiers,
Marching as to war,
With the cross of Jesus
Going on before.
      `, {
        repeatMode: 'each-verse',
        repeatAfterSectionTypes: ['verse'],
        visuallyDistinct: true,
      }),
      S('v1', 'verse', 'Verse 1', 2, `
Christ, the royal Master,
Leads against the foe;
Forward into battle,
See His banners go!
      `),
      S('v2', 'verse', 'Verse 2', 3, `
At the sign of triumph
Satan's host doth flee;
On then, Christian soldiers,
On to victory!
      `),
      S('v3', 'verse', 'Verse 3', 4, `
Like a mighty army
Moves the Church of God;
Brothers, we are treading
Where the saints have trod.
      `),
      S('v4', 'verse', 'Verse 4', 5, `
Crowns and thrones may perish,
Kingdoms rise and wane,
But the Church of Jesus
Constant will remain.
      `),
    ],
  }),
  hymn({
    id: 'praise-god-from-whom-all-blessings-flow',
    title: 'Praise God, from Whom All Blessings Flow',
    alternateTitles: ['The Doxology'],
    firstLine: 'Praise God, from whom all blessings flow',
    meter: 'LM',
    authors: [A('Thomas Ken', 'text'), A('Louis Bourgeois tradition', 'tune')],
    tunes: [T('OLD 100TH', 'Louis Bourgeois', 'LM')],
    themes: ['praise', 'thanksgiving', 'majesty'],
    scriptureThemes: ['James 1:17', 'Psalm 150:6', 'Romans 11:36'],
    copyright: pdCopyright('Text: Thomas Ken.', 'Tune: OLD 100TH, public domain.'),
    searchKeywords: ['doxology', 'offering', 'praise', 'amen'],
    presentationDefaults: defaults('praise', 'broadcast-lower-third-worship', 'either', false),
    sections: [
      S('dx1', 'doxology', 'Doxology', 1, `
Praise God, from whom all blessings flow;
Praise Him, all creatures here below;
Praise Him above, ye heavenly host;
Praise Father, Son, and Holy Ghost. Amen.
      `),
    ],
  }),
  hymn({
    id: 'praise-to-the-lord-the-almighty',
    title: 'Praise to the Lord, the Almighty',
    alternateTitles: ['Lobe den Herren'],
    firstLine: 'Praise to the Lord, the Almighty, the King of creation!',
    meter: '14.14.4.7.8',
    authors: [A('Joachim Neander', 'text'), A('Catherine Winkworth', 'translator')],
    tunes: [T('LOBE DEN HERREN')],
    themes: ['praise', 'majesty', 'assurance'],
    scriptureThemes: ['Psalm 103:1-5', 'Psalm 150', 'Isaiah 46:4'],
    copyright: pdCopyright('Text: Joachim Neander / English by Catherine Winkworth.', 'Tune: LOBE DEN HERREN, public domain.'),
    searchKeywords: ['praise', 'opening', 'confidence', 'king of creation'],
    presentationDefaults: defaults('praise', 'big-hall-readability', 'motion', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Praise to the Lord, the Almighty, the King of creation!
O my soul, praise Him, for He is thy health and salvation!
All ye who hear,
Now to His temple draw near;
Join me in glad adoration!
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Praise to the Lord, who o'er all things so wondrously reigneth,
Shelters thee under His wings, yea, so gently sustaineth!
Hast thou not seen
How thy desires e'er have been
Granted in what He ordaineth?
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Praise to the Lord, who doth prosper thy work and defend thee;
Surely His goodness and mercy here daily attend thee.
Ponder anew
What the Almighty can do,
If with His love He befriend thee.
      `),
      S('v4', 'verse', 'Verse 4', 4, `
Praise to the Lord! O let all that is in me adore Him!
All that hath life and breath, come now with praises before Him!
Let the Amen
Sound from His people again;
Gladly for aye we adore Him.
      `),
    ],
  }),
  hymn({
    id: 'rock-of-ages-cleft-for-me',
    title: 'Rock of Ages, Cleft for Me',
    alternateTitles: ['Toplady'],
    firstLine: 'Rock of Ages, cleft for me',
    meter: '7.7.7.7.7.7',
    authors: [A('Augustus M. Toplady', 'text'), A('Thomas Hastings', 'tune')],
    tunes: [T('TOPLADY', 'Thomas Hastings'), T('REDHEAD 76', 'Richard Redhead')],
    themes: ['grace', 'comfort', 'assurance'],
    scriptureThemes: ['Exodus 33:22', '1 Corinthians 10:4', 'Hebrews 9:14'],
    copyright: pdCopyright('Text: Augustus M. Toplady.', 'Tunes: TOPLADY / REDHEAD 76, public domain.'),
    searchKeywords: ['atonement', 'refuge', 'salvation', 'rock'],
    presentationDefaults: defaults('grace', 'classic-worship-serif', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Rock of Ages, cleft for me,
Let me hide myself in Thee;
Let the water and the blood,
From Thy wounded side which flowed,
Be of sin the double cure;
Save from wrath and make me pure.
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Could my tears forever flow,
Could my zeal no languor know,
These for sin could not atone;
Thou must save, and Thou alone;
In my hand no price I bring,
Simply to Thy cross I cling.
      `),
      S('v3', 'verse', 'Verse 3', 3, `
While I draw this fleeting breath,
When mine eyes shall close in death,
When I soar to worlds unknown,
See Thee on Thy judgment throne,
Rock of Ages, cleft for me,
Let me hide myself in Thee.
      `),
    ],
  }),
  hymn({
    id: 'sweet-hour-of-prayer',
    title: 'Sweet Hour of Prayer',
    alternateTitles: [],
    firstLine: 'Sweet hour of prayer! sweet hour of prayer!',
    meter: '8.6.8.6.8.8.8.6',
    authors: [A('William W. Walford', 'text'), A('William B. Bradbury', 'tune')],
    tunes: [T('SWEET HOUR', 'William B. Bradbury')],
    themes: ['prayer', 'communion', 'comfort'],
    scriptureThemes: ['Matthew 6:6', 'Philippians 4:6', 'Hebrews 4:16'],
    copyright: pdCopyright('Text: William W. Walford.', 'Tune: SWEET HOUR by William B. Bradbury.'),
    searchKeywords: ['prayer', 'devotion', 'communion', 'secret place'],
    presentationDefaults: defaults('prayer', 'classic-worship-serif', 'still', false),
    sections: [
      S('v1', 'verse', 'Verse 1', 1, `
Sweet hour of prayer! sweet hour of prayer!
That calls me from a world of care,
And bids me at my Father's throne
Make all my wants and wishes known.
In seasons of distress and grief,
My soul has often found relief,
And oft escaped the tempter's snare,
By thy return, sweet hour of prayer!
      `),
      S('v2', 'verse', 'Verse 2', 2, `
Sweet hour of prayer! sweet hour of prayer!
Thy wings shall my petition bear
To Him whose truth and faithfulness
Engage the waiting soul to bless.
And since He bids me seek His face,
Believe His word, and trust His grace,
I'll cast on Him my every care,
And wait for thee, sweet hour of prayer!
      `),
      S('v3', 'verse', 'Verse 3', 3, `
Sweet hour of prayer! sweet hour of prayer!
May I thy consolation share,
Till, from Mount Pisgah's lofty height,
I view my home and take my flight.
This robe of flesh I'll drop, and rise
To seize the everlasting prize;
And shout, while passing through the air,
Farewell, farewell, sweet hour of prayer!
      `),
    ],
  }),
];

export const PUBLIC_DOMAIN_HYMN_METADATA: HymnMetadataRecord[] = PUBLIC_DOMAIN_HYMNS.map((entry) => ({
  id: entry.id,
  title: entry.title,
  alternateTitles: entry.alternateTitles,
  firstLine: entry.firstLine,
  meter: entry.meter,
  authors: entry.authors,
  tunes: entry.tunes,
  themes: entry.themes,
  scriptureThemes: entry.scriptureThemes,
  copyright: entry.copyright,
  searchKeywords: entry.searchKeywords,
  presentationDefaults: entry.presentationDefaults,
  librarySource: entry.librarySource,
  usageRights: entry.usageRights,
  searchIndex: entry.searchIndex,
  sectionCount: entry.sections.length,
}));
