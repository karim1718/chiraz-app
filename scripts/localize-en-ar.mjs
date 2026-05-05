/** Applied on deep clones of FR locale tree to produce EN / AR storefront strings. */

export function localizeEnglish(t) {
  t.languageSwitcher.aria = 'Choose language';

  Object.assign(t.common, {
    close: 'Close',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    search: 'Search',
    home: 'Home',
    shop: 'Shop',
    about: 'About',
    contact: 'Contact',
    faq: 'FAQ',
    legal: 'Legal notice',
    privacy: 'Privacy policy',
    loading: 'Loading...',
    scrollLeft: 'Scroll left',
    scrollRight: 'Scroll right',
    slide: 'Slide',
    previous: 'Previous',
    next: 'Next',
    copyLink: 'Copy link',
    share: 'Share',
    catalog: 'Catalog',
    backToCatalog: 'Back to catalog',
    new: 'New',
    saleUpTo: 'Up to -{{percent}}%',
    sale: 'Sale -{{percent}}%',
    quickView: 'Quick view',
    favorites: 'Favorites',
    fromPrice: 'From {{price}}',
    color: 'Color',
    size: 'Size',
    material: 'Material',
    price: 'Price ({{code}})',
    filterClose: 'Close filters',
    results_one: '{{count}} result',
    results_other: '{{count}} results',
    resetFilters: 'Reset filters',
    allLoaded: 'All products loaded',
    noMatch: 'No products match your filters.',
    sortBy: 'Sort by',
    sort: 'Sort',
    filters: 'Filters',
    categories: 'Categories',
    account: 'Account',
    myAccount: 'My account',
    myOrders: 'My orders',
    whatsapp: 'WhatsApp',
    searchLabel: 'Search',
    mainNav: 'Main navigation',
    collectionShoes: 'Shoe collection',
    collectionSandals: 'Sandal collection',
    newArrivals: 'New arrivals',
    promos: 'Promotions',
    contactSection: 'Contact',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    orderRef: 'No. {{id}}',
    needHelp: 'Need help?',
    contactWhatsapp: 'Contact on WhatsApp',
    backHome: 'Back to home',
    logo: 'Chiraz',
    logoChiraz: 'CHIRAZ Logo',
  });

  Object.assign(t.nav, { shoes: 'SHOES', sandals: 'SANDALS' });
  Object.assign(t.header, { categoriesAria: 'Categories', actionsAria: 'Actions' });

  Object.assign(t.footer, {
    brand:
      'Premium footwear, craftsmanship and elegance. For those who refuse to compromise on quality.',
    navigation: 'Navigation',
    help: 'Help',
    directContact: 'Direct contact',
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    rights: '© {{year}} Chiraz',
    helpFaq: 'FAQ',
    helpReturns: 'Returns policy',
    helpSize: 'Size guide',
    helpTrack: 'Track order',
    home: 'Home',
    about: 'About',
    contact: 'Contact',
    shop: 'Shop',
  });

  Object.assign(t.bottomNav, { aria: 'Main navigation' });
  Object.assign(t.mobileNav, {
    backHome: 'Back to home',
    mainNav: 'Main navigation',
    categories: 'Categories',
  });

  Object.assign(t.meta.home, {
    title: 'Chiraz — Premium footwear',
    description: 'Premium footwear, craftsmanship and elegance.',
  });
  Object.assign(t.meta.shop, {
    title: 'Catalog — Chiraz',
    description: 'Discover our men’s and women’s collections.',
  });
  Object.assign(t.meta.about, {
    title: 'About — Chiraz',
    description: 'Our story, values and craftsmanship.',
  });
  Object.assign(t.meta.contact, {
    title: 'Contact — Chiraz',
    description: 'Reach us via the form or WhatsApp.',
  });
  Object.assign(t.meta.faq, {
    title: 'FAQ — Chiraz',
    description: 'Shipping, sizing and returns — frequently asked questions.',
  });
  Object.assign(t.meta.returns, {
    title: 'Returns policy — Chiraz',
    description: 'Conditions and return process.',
  });
  Object.assign(t.meta.checkout, {
    title: 'Checkout — Chiraz',
    description: 'Complete your order.',
  });
  Object.assign(t.meta.confirmation, {
    title: 'Order sent — Chiraz',
    description: 'Your order has been recorded.',
  });
  Object.assign(t.meta.legal, {
    title: 'Legal notice — Chiraz',
    description: 'Legal information for chiraz.tn.',
  });
  Object.assign(t.meta.privacy, {
    title: 'Privacy — Chiraz',
    description: 'Privacy policy.',
  });
  Object.assign(t.meta.product, {
    title: 'Product — Chiraz',
    description: 'Product details — Chiraz.',
  });
  t.meta.defaultTitle = 'Chiraz — Premium footwear';

  Object.assign(t.hero, {
    title: 'Elegance. Redefined.',
    subtitle: 'Discover everyday luxury with <chiraz>CHIRAZ</chiraz>.',
    ctaShoes: 'SHOE COLLECTION',
    ctaSandals: 'SANDAL COLLECTION',
  });

  Object.assign(t.collections, {
    title: 'Our collections',
    discover: 'Discover',
    colShoes: 'Shoe collection',
    colSandals: 'Sandal collection',
  });

  Object.assign(t.productCarousel, {
    title: 'Our favorites',
    subtitle: '',
    cta: 'Quick view',
    twoColors: 'Available in 2 colors',
    p1: { name: 'Urban black sneaker' },
    p2: { name: 'Essential beige trainers' },
    p3: { name: 'Elegant pink slip-on' },
    p4: { name: 'Monochrome sneaker' },
    p5: { name: 'Minimal trainers' },
    p6: { name: 'Absolute comfort' },
  });

  Object.assign(t.material, {
    alt: 'Premium materials — detail',
    h2a: 'Premium materials.',
    h2b: 'Zero compromise.',
    p:
      'At CHIRAZ, every shoe is crafted with meticulously chosen materials. Discover the perfect balance of breathability, durability and everyday softness.',
    f1t: 'Cloud comfort',
    f1d: 'Our signature soles hug your foot with invisible support.',
    f2t: 'Ultra-breathable fabric',
    f2d: 'Keeps feet fresh and light all day without sacrificing elegance.',
    cta: 'DISCOVER OUR MATERIALS',
  });

  Object.assign(t.testimonials, {
    title: 'They trust us',
    subtitle: 'Customers across Tunisia — genuine feedback after ordering.',
    t1: {
      name: 'Salma K.',
      city: 'Tunis',
      text:
        'Second order and still delighted. The heels are sturdy and elegant — perfect for downtown work.',
    },
    t2: {
      name: 'Mehdi R.',
      city: 'Sfax',
      text:
        'Serious leather for a fair price. The derbies are spot on — delivery to Sfax without issues.',
    },
    t3: {
      name: 'Lina B.',
      city: 'Sousse',
      text:
        'Well-protected parcel, comfortable ballerinas from day one. I recommend them to friends by the coast.',
    },
    t4: {
      name: 'Amine B.',
      city: 'La Marsa',
      text:
        'Responsive customer care on WhatsApp. I changed my size without hassle. Very satisfied.',
    },
    t5: {
      name: 'Nour D.',
      city: 'Nabeul',
      text:
        'Derbies for my husband — he never takes them off. Clean finishing; you can tell it’s quality work.',
    },
    t6: {
      name: 'Firas K.',
      city: 'Bizerte',
      text:
        'Excellent value. Neat trainers, ideal for the weekend — fast delivery to Bizerte.',
    },
  });

  Object.assign(t.whatsappFloat, { aria: 'Contact on WhatsApp', tooltip: 'Need help?' });

  Object.assign(t.catalog, {
    title: 'Catalog',
    sortNew: 'New arrivals',
    sortPriceAsc: 'Price: low to high',
    sortPriceDesc: 'Price: high to low',
    sortPopular: 'Popularity',
    selectSize: 'Select your size:',
    buyNow: 'Buy now',
    seeFull: 'View full product',
    chaussures: 'Shoes',
    sandales: 'Sandals',
    apply_one: 'Apply ({{count}} result)',
    apply_other: 'Apply ({{count}} results)',
    badgeNewDb: 'New',
    saleUpToBadge: 'Up to -{{percent}}%',
    salePercent: 'Sale -{{percent}}%',
    favoriteAria: 'Favorites',
    quickViewAria: 'Quick view',
    filtersMobile: 'Filters',
    sortMobile: 'Sort',
    sortSheetTitle: 'Sort by',
    loadedAll: 'All products have been loaded',
  });

  Object.assign(t.productDetail, {
    notFound: 'Product not found.',
    backCatalog: '← Catalog',
    guideTitle: 'Size guide',
    sizeEu: 'EU',
    sizeUk: 'UK',
    sizeUs: 'US',
    sizeCm: 'CM',
    similar: 'You may also like',
    buyNow: 'Buy now',
    selectSizeCta: 'Select a size',
    waOrder: 'Order on WhatsApp',
    buyBar: 'Buy',
    accDesc: 'Description',
    accMat: 'Materials & construction',
    accCare: 'Care',
    accShip: 'Shipping & returns',
    accDescBody:
      'Premium shoe {{name}}, combining comfort and elegance. Careful cut and selected materials for durable everyday wear.',
    accMatBody: '{{material}}. Careful construction for a luxurious finish and easier care.',
    accCareBody:
      'Clean with a soft damp cloth. Avoid excess water. Use suitable leather care products to preserve the material.',
    accShipBody:
      'Standard shipping in 3–5 business days. Free returns within 30 days for unworn items. See our Returns page for details.',
    shareSuffix: ' | Chiraz',
    waIntro: 'Hello, I would like to order the following item:',
    waProduct: 'Product',
    waSize: 'Size',
    waColor: 'Color',
    waPrice: 'Price',
    waUnspecified: 'Not specified',
    imageNum: 'Image {{n}}',
  });

  Object.assign(t.quickOrder, {
    title: 'Quick purchase',
    sizeLabel: 'Size: {{size}}',
    notSelected: 'Not selected',
    perUnit: '{{price}} each',
    summary: 'Order summary',
    subtotal: 'Subtotal',
    delivery: 'Shipping',
    deliveryFree: 'Shipping (not charged)',
    total: 'Total',
    fullName: 'Full name',
    phone: 'Phone',
    city: 'City',
    deliveryFee: 'Shipping fee',
    deliveryHint: 'Amount added to the total (editable for this order).',
    deliveryAdmin: 'Shipping waived or not charged on the shop (admin setting).',
    confirm: 'Confirm my order',
    wa: 'Order on WhatsApp',
    errSize: 'Please select a size.',
    errGeneric: 'An unexpected error occurred.',
    waLineProduct: 'Product',
    waLineSize: 'Size',
    waLineColor: 'Color',
    waLineUnit: 'Unit price',
    waLineSub: 'Subtotal',
    waLineShip: 'Shipping',
    waLineTotal: 'Total',
    waLineName: 'Name',
    waLineTel: 'Tel',
    waLineCity: 'City',
    waIntro: 'Hello, I would like to order the following item:',
  });

  Object.assign(t.search, {
    placeholder: 'Search for a shoe...',
    aria: 'Search',
    clear: 'Clear',
    trends: 'Trending',
    popular: 'Popular searches',
    resultsFor_one: '{{count}} result for “{{query}}”',
    resultsFor_other: '{{count}} results for “{{query}}”',
    empty: 'No results for “{{query}}”',
    emptyHint: 'Try: Derby, Oxford, Chelsea, pump, leather...',
    tagDerby: 'Derby',
    tagOxford: 'Oxford',
    tagCuir: 'Leather',
    tagNew: 'New collection',
    tagChelsea: 'Chelsea',
    tagEscarpin: 'Pump',
    tagBallerine: 'Ballet flat',
    tagSneaker: 'Sneaker',
  });

  Object.assign(t.contact, {
    title: 'Contact',
    lead: 'A question or a project? We are here for you.',
    name: 'Name',
    email: 'Email',
    subject: 'Subject',
    message: 'Message',
    placeholderName: 'Your name',
    placeholderEmail: 'you@example.com',
    chooseSubject: 'Choose a subject',
    placeholderMessage: 'Your message...',
    send: 'Send',
    sending: 'Sending...',
    sent: 'Message sent. We will reply as soon as possible.',
    emailDisabled:
      'Email sending disabled: add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID and VITE_EMAILJS_PUBLIC_KEY to a .env file at the project root, then restart npm run dev.',
    sendFailed:
      "Sending failed. Check the console (F12), your EmailJS credentials and that template variable names match (from_name, from_email, subject, message).",
    waCta: 'Message us on WhatsApp',
    subjects: [
      'Order question',
      'Product question',
      'Return / exchange',
      'Partnership',
      'Other',
    ],
    addressLine: '123 Avenue de la République, Tunisia',
  });

  Object.assign(t.confirmation, {
    title: 'Your order has been sent',
    subtitle: 'Order sent! We will contact you within 2 hours 🎉',
    orderNo: 'No. {{id}}',
    home: 'Back to home',
  });

  Object.assign(t.about, {
    heroKicker: 'Chiraz · since 1978',
    heroTitle: 'Our story',
    heroLead: 'The excellence of Tunisian craftsmanship',
    storyTitle: 'Our story',
    storySub: 'A Tunisian house · 1978 → today',
    storyP1:
      'Since 1978, Chiraz embodies the excellence of Tunisian craftsmanship: workshops where leather is cut, assembled and finished with rigour, for accessible premium shoes. Our story is one of lasting passion — from generation to generation — in service of beauty and quality.',
    storyP2:
      'Available across Tunisia, we connect the workshop to the end customer: online retail for simple ordering, and wholesale for partners who share our standards. Every model carries this promise: authentic quality, contemporary elegance, and respect for everyone who trusts us.',
    valuesTitle: 'Our values',
    countersTitle: 'Since 1978',
    countersClients: 'Happy customers',
    countersLeather: 'Genuine leather',
    v1t: 'Craftsmanship',
    v1d:
      'Each pair is made with inherited artisan techniques and demanding quality control, from leather cutting to finishing.',
    v2t: 'Durability',
    v2d:
      'We favour durable materials and responsible processes for shoes that stand the test of time.',
    v3t: 'Elegance',
    v3d:
      'Clean lines and refined details: a contemporary aesthetic rooted in tradition.',
    e1t: 'The excellence of Tunisian craftsmanship',
    e1d:
      'Inherited artisan techniques and rigorous quality control, proudly anchored in Tunisia.',
    e2t: 'Available throughout Tunisia',
    e2d:
      'Delivery and presence designed to reach customers from north to south.',
    e3t: 'Online & wholesale',
    e3d:
      'Order on our online shop or work with us in volume for professional needs.',
    e4t: 'From workshop to customer',
    e4d:
      'A controlled chain: cutting, assembly, finishing — down to the pair you wear every day.',
  });

  Object.assign(t.returns, {
    title: 'Returns policy',
    updated: 'Last updated: January 2026',
    tocMobile: 'Jump to section',
    tocPlaceholder: 'Jump to section...',
    tocSidebar: 'Contents',
    s1h: 'General conditions',
    s2h: 'Return window',
    s3h: 'Process',
    s4h: 'Refunds',
    s5h: 'Exceptions',
    s1p1:
      'Chiraz lets you return or exchange any item ordered on chiraz.tn subject to the conditions below. Items must be returned in original condition, unworn, unwashed and in original packaging when possible.',
    s1p2:
      'Customised items or those marked “sale — non-returnable” at purchase are excluded, except in case of defect or our error.',
    s2p:
      'You have 30 calendar days from receipt of your parcel to notify us of a return or exchange. After that, no return request can be accepted.',
    s3intro: 'To start a return or exchange:',
    s3li1:
      'Email us at returns@chiraz.tn with your order number and the items concerned.',
    s3li2:
      'We send instructions and, if applicable, a return label.',
    s3li3:
      'Pack the item(s) carefully and drop the parcel at the indicated relay or carrier.',
    s3li4:
      'Keep proof of shipment until you receive refund confirmation or the exchange shipment.',
    s3p2:
      'Return shipping is paid by the customer unless the product is defective or we made an error (wrong item, size, etc.).',
    s4p1:
      'After receipt and inspection, refunds are issued within 7–14 days to the original payment method. Initial shipping fees are not refunded unless the return is due to our error or a defect.',
    s4p2:
      'For an exchange, a new item ships after validation. If the new item costs more, we will request the difference; if less, the difference is refunded.',
    s5p1:
      'We may refuse a return if the item does not meet the conditions (condition, packaging, deadline). For damaged or incorrect items, contact us immediately with photos; we will cover return and reshipment or refund.',
    s5p2: 'Questions: returns@chiraz.tn or via the contact form.',
    contactLink: 'Contact us',
  });

  Object.assign(t.legal, {
    title: 'Legal notice',
    updated: 'Last updated: January 2026',
    editor: 'Publisher',
    editorBody:
      'The chiraz.tn website is published by Chiraz. Registered office: Sfax, Tunisia — 51 Avenue 5 Août, Sfax 3002.',
    hosting: 'Hosting',
    hostingBody:
      'The site is hosted by a technical provider. For access or availability questions, contact contact@chiraz.tn.',
    ip: 'Intellectual property',
    ipBody:
      'All content (texts, images, logos, visuals) is protected by copyright and trademark law. Any unauthorised reproduction is prohibited.',
    contact: 'Contact',
    contactBody: 'For legal questions: contact@chiraz.tn.',
  });

  Object.assign(t.privacy, {
    title: 'Privacy policy',
    updated: 'Last updated: January 2026',
    collected: 'Data collected',
    collectedBody:
      'When you use the site and place orders, we may collect your name, email, postal address, phone number and order details. This data is required to process orders and manage customer relations.',
    use: 'Use',
    useBody:
      'Data is used for order fulfilment, delivery, customer service and, with your consent, marketing messages (newsletter, offers). It is not sold to third parties for marketing.',
    rights: 'Your rights',
    rightsBody:
      'You may access, rectify, delete or object to processing of your personal data. contact@chiraz.tn.',
    security: 'Security',
    securityBody:
      'We implement technical and organisational measures to protect your data against unauthorised access, loss or alteration.',
  });

  Object.assign(t.currency, { long: 'Tunisian dinar' });

  t.faq.title = 'FAQ';
}

export function localizeArabic(t) {
  t.languageSwitcher.aria = 'اختر اللغة';

  Object.assign(t.common, {
    close: 'إغلاق',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    search: 'بحث',
    home: 'الرئيسية',
    shop: 'المتجر',
    about: 'من نحن',
    contact: 'اتصل بنا',
    faq: 'الأسئلة الشائعة',
    legal: 'الإشعارات القانونية',
    privacy: 'سياسة الخصوصية',
    loading: 'جارٍ التحميل...',
    scrollLeft: 'التمرير لليسار',
    scrollRight: 'التمرير لليمين',
    slide: 'شريحة',
    previous: 'السابق',
    next: 'التالي',
    copyLink: 'نسخ الرابط',
    share: 'مشاركة',
    catalog: 'الكتالوج',
    backToCatalog: 'العودة إلى الكتالوج',
    new: 'جديد',
    saleUpTo: 'حتى -{{percent}}٪',
    sale: 'تخفيضات -{{percent}}٪',
    quickView: 'معاينة سريعة',
    favorites: 'المفضلة',
    fromPrice: 'من {{price}}',
    color: 'اللون',
    size: 'المقاس',
    material: 'المادة',
    price: 'السعر ({{code}})',
    filterClose: 'إغلاق المرشحات',
    results_one: '{{count}} نتيجة',
    results_other: '{{count}} نتائج',
    resetFilters: 'إعادة تعيين المرشحات',
    allLoaded: 'تم تحميل جميع المنتجات',
    noMatch: 'لا يوجد منتج يطابق معاييرك.',
    sortBy: 'ترتيب حسب',
    sort: 'ترتيب',
    filters: 'مرشحات',
    categories: 'الفئات',
    account: 'الحساب',
    myAccount: 'حسابي',
    myOrders: 'طلباتي',
    whatsapp: 'واتساب',
    searchLabel: 'بحث',
    mainNav: 'التنقل الرئيسي',
    collectionShoes: 'تشكيلة الأحذية',
    collectionSandals: 'تشكيلة الصنادل',
    newArrivals: 'وصل حديثًا',
    promos: 'عروض',
    contactSection: 'اتصل بنا',
    email: 'البريد',
    phone: 'الهاتف',
    address: 'العنوان',
    orderRef: 'رقم {{id}}',
    needHelp: 'تحتاج مساعدة؟',
    contactWhatsapp: 'التواصل عبر واتساب',
    backHome: 'العودة إلى الرئيسية',
    logo: 'شيراز',
    logoChiraz: 'شعار CHIRAZ',
  });

  Object.assign(t.nav, { shoes: 'أحذية', sandals: 'صنادل' });
  Object.assign(t.header, { categoriesAria: 'الفئات', actionsAria: 'إجراءات' });

  Object.assign(t.footer, {
    brand: 'أحذية فاخرة وحرفية وأناقة. لمن لا يقبلون المساومة على الجودة.',
    navigation: 'التنقل',
    help: 'مساعدة',
    directContact: 'اتصال مباشر',
    instagram: 'إنستغرام',
    facebook: 'فيسبوك',
    tiktok: 'تيك توك',
    rights: '© {{year}} Chiraz',
    helpFaq: 'الأسئلة الشائعة',
    helpReturns: 'سياسة الإرجاع',
    helpSize: 'دليل المقاسات',
    helpTrack: 'تتبع الطلب',
    home: 'الرئيسية',
    about: 'من نحن',
    contact: 'اتصل بنا',
    shop: 'المتجر',
  });

  Object.assign(t.bottomNav, { aria: 'التنقل الرئيسي' });
  Object.assign(t.mobileNav, {
    backHome: 'العودة إلى الرئيسية',
    mainNav: 'التنقل الرئيسي',
    categories: 'الفئات',
  });

  Object.assign(t.meta.home, {
    title: 'Chiraz — أحذية فاخرة',
    description: 'أحذية فاخرة وحرفية وأناقة.',
  });
  Object.assign(t.meta.shop, {
    title: 'الكتالوج — Chiraz',
    description: 'اكتشف مجموعاتنا للرجال والنساء.',
  });
  Object.assign(t.meta.about, {
    title: 'من نحن — Chiraz',
    description: 'قصتنا وقيمنا وحرفيتنا.',
  });
  Object.assign(t.meta.contact, {
    title: 'اتصل بنا — Chiraz',
    description: 'تواصل معنا عبر النموذج أو واتساب.',
  });
  Object.assign(t.meta.faq, {
    title: 'الأسئلة الشائعة — Chiraz',
    description: 'الشحن والمقاسات والإرجاع.',
  });
  Object.assign(t.meta.returns, {
    title: 'سياسة الإرجاع — Chiraz',
    description: 'الشروط وإجراءات الإرجاع.',
  });
  Object.assign(t.meta.checkout, {
    title: 'إتمام الطلب — Chiraz',
    description: 'أكمل طلبك.',
  });
  Object.assign(t.meta.confirmation, {
    title: 'تم إرسال الطلب — Chiraz',
    description: 'تم تسجيل طلبك.',
  });
  Object.assign(t.meta.legal, {
    title: 'الإشعارات القانونية — Chiraz',
    description: 'معلومات قانونية عن الموقع.',
  });
  Object.assign(t.meta.privacy, {
    title: 'الخصوصية — Chiraz',
    description: 'سياسة الخصوصية.',
  });
  Object.assign(t.meta.product, {
    title: 'المنتج — Chiraz',
    description: 'تفاصيل المنتج.',
  });
  t.meta.defaultTitle = 'Chiraz — أحذية فاخرة';

  Object.assign(t.hero, {
    title: 'إعادة تعريف الأناقة.',
    subtitle: 'اكتشف الرفاهية اليومية مع <chiraz>CHIRAZ</chiraz>.',
    ctaShoes: 'تشكيلة الأحذية',
    ctaSandals: 'تشكيلة الصنادل',
  });

  Object.assign(t.collections, {
    title: 'مجموعاتنا',
    discover: 'اكتشف',
    colShoes: 'تشكيلة الأحذية',
    colSandals: 'تشكيلة الصنادل',
  });

  Object.assign(t.productCarousel, {
    title: 'مفضلاتنا',
    subtitle: '',
    cta: 'معاينة سريعة',
    twoColors: 'متوفر بلونين',
    p1: { name: 'سنيكر أسود حضري' },
    p2: { name: 'حذاء رياضي بيج أساسي' },
    p3: { name: 'سلِب أون أنيق وردي' },
    p4: { name: 'سنيكر أحادي اللون' },
    p5: { name: 'حذاء رياضي بسيط' },
    p6: { name: 'راحة مطلقة' },
  });

  Object.assign(t.material, {
    alt: 'تفاصيل المواد الفاخرة',
    h2a: 'مواد فاخرة.',
    h2b: 'بلا مساومة.',
    p:
      'في CHIRAZ، كل حذاء صُنع بمواد مختارة بعناية. اكتشف التوازن المثالي بين التهوية والمتانة والنعومة اليومية.',
    f1t: 'راحة كالغيم',
    f1d: 'نعالنا التوقيعية تحتضن القدم بدعم خفي.',
    f2t: 'نسيج فائق التهوية',
    f2d: 'يبقي القدمين منتعشتين وخفيفتين طوال اليوم دون التفريط بالأناقة.',
    cta: 'اكتشف موادنا',
  });

  Object.assign(t.testimonials, {
    title: 'يثقون بنا',
    subtitle: 'آراء من تونس — تجارب حقيقية بعد الطلب.',
    t1: {
      name: 'سلمى ك.',
      city: 'تونس',
      text: 'طلب ثانٍ وما زلت راضية. الكعب قوي وأنيق — مثالي للعمل.',
    },
    t2: {
      name: 'مهدي ر.',
      city: 'صفاقس',
      text: 'جلد جاد مقابل سعر مناسب. التسليم إلى صفاقس بلا مشاكل.',
    },
    t3: {
      name: 'لينا ب.',
      city: 'سوسة',
      text: 'طرد محمي جيدًا، باليرينات مريحة من أول يوم.',
    },
    t4: {
      name: 'أمين ب.',
      city: 'المرسى',
      text: 'خدمة سريعة على واتساب. غيّرت المقاس بسهولة.',
    },
    t5: {
      name: 'نور د.',
      city: 'نابل',
      text: 'دراجي لزوجي — لا يخلعها. تشطيب نظيف.',
    },
    t6: {
      name: 'فِراس ك.',
      city: 'بنزرت',
      text: 'جودة وسعر ممتازان. تسليم سريع إلى بنزرت.',
    },
  });

  Object.assign(t.whatsappFloat, { aria: 'التواصل عبر واتساب', tooltip: 'تحتاج مساعدة؟' });

  Object.assign(t.catalog, {
    title: 'الكتالوج',
    sortNew: 'جديد',
    sortPriceAsc: 'السعر تصاعديًا',
    sortPriceDesc: 'السعر تنازليًا',
    sortPopular: 'الأكثر شعبية',
    selectSize: 'اختر مقاسك:',
    buyNow: 'اشترِ الآن',
    seeFull: 'عرض المنتج كاملًا',
    chaussures: 'أحذية',
    sandales: 'صنادل',
    apply_one: 'تطبيق ({{count}} نتيجة)',
    apply_other: 'تطبيق ({{count}} نتائج)',
    badgeNewDb: 'جديد',
    saleUpToBadge: 'حتى -{{percent}}٪',
    salePercent: 'تخفيضات -{{percent}}٪',
    favoriteAria: 'المفضلة',
    quickViewAria: 'معاينة سريعة',
    filtersMobile: 'مرشحات',
    sortMobile: 'ترتيب',
    sortSheetTitle: 'ترتيب حسب',
    loadedAll: 'تم تحميل جميع المنتجات',
  });

  Object.assign(t.productDetail, {
    notFound: 'المنتج غير موجود.',
    backCatalog: '← الكتالوج',
    guideTitle: 'دليل المقاسات',
    sizeEu: 'EU',
    sizeUk: 'UK',
    sizeUs: 'US',
    sizeCm: 'سم',
    similar: 'قد يعجبك أيضًا',
    buyNow: 'اشترِ الآن',
    selectSizeCta: 'اختر مقاسًا',
    waOrder: 'اطلب عبر واتساب',
    buyBar: 'اشترِ',
    accDesc: 'الوصف',
    accMat: 'المواد والتصنيع',
    accCare: 'العناية',
    accShip: 'الشحن والإرجاع',
    accDescBody:
      'حذاء فاخر {{name}} يجمع الراحة والأناقة. قصة مدروسة ومواد مختارة لارتداء يومي يدوم.',
    accMatBody: '{{material}}. تصنيع بعناية للمسة فاخرة وعناية أسهل.',
    accCareBody:
      'انظف بقطعة قماش ناعمة ورطبة. تجنب الماء الزائد. استخدم منتجات العناية المناسبة للجلد.',
    accShipBody:
      'شحن قياسي خلال 3–5 أيام عمل. إرجاع مجاني خلال 30 يومًا للقطع غير الملبوسة. راجع صفحة الإرجاع.',
    shareSuffix: ' | Chiraz',
    waIntro: 'مرحبًا، أرغب في طلب المنتج التالي:',
    waProduct: 'المنتج',
    waSize: 'المقاس',
    waColor: 'اللون',
    waPrice: 'السعر',
    waUnspecified: 'غير محدد',
    imageNum: 'صورة {{n}}',
  });

  Object.assign(t.quickOrder, {
    title: 'شراء سريع',
    sizeLabel: 'المقاس: {{size}}',
    notSelected: 'غير محدد',
    perUnit: '{{price}} للقطعة',
    summary: 'ملخص الطلب',
    subtotal: 'المجموع الفرعي',
    delivery: 'التوصيل',
    deliveryFree: 'التوصيل (غير محسوب)',
    total: 'الإجمالي',
    fullName: 'الاسم الكامل',
    phone: 'الهاتف',
    city: 'المدينة',
    deliveryFee: 'رسوم التوصيل',
    deliveryHint: 'المبلغ يُضاف إلى الإجمالي (قابل للتعديل لهذا الطلب).',
    deliveryAdmin: 'توصيل مجاني أو غير محسوب حسب إعدادات المتجر.',
    confirm: 'تأكيد طلبي',
    wa: 'اطلب عبر واتساب',
    errSize: 'يرجى اختيار مقاس.',
    errGeneric: 'حدث خطأ غير متوقع.',
    waLineProduct: 'المنتج',
    waLineSize: 'المقاس',
    waLineColor: 'اللون',
    waLineUnit: 'سعر الوحدة',
    waLineSub: 'المجموع الفرعي',
    waLineShip: 'التوصيل',
    waLineTotal: 'الإجمالي',
    waLineName: 'الاسم',
    waLineTel: 'الهاتف',
    waLineCity: 'المدينة',
    waIntro: 'مرحبًا، أرغب في طلب المنتج التالي:',
  });

  Object.assign(t.search, {
    placeholder: 'ابحث عن حذاء...',
    aria: 'بحث',
    clear: 'مسح',
    trends: 'رائج',
    popular: 'عمليات بحث شائعة',
    resultsFor_one: '{{count}} نتيجة لـ «{{query}}»',
    resultsFor_other: '{{count}} نتائج لـ «{{query}}»',
    empty: 'لا نتائج لـ «{{query}}»',
    emptyHint: 'جرّب: ديربي، أوكسفورد، تشيلسي، كعب، جلد...',
    tagDerby: 'ديربي',
    tagOxford: 'أوكسفورد',
    tagCuir: 'جلد',
    tagNew: 'مجموعة جديدة',
    tagChelsea: 'تشيلسي',
    tagEscarpin: 'كعب',
    tagBallerine: 'باليرينا',
    tagSneaker: 'سنيكر',
  });

  Object.assign(t.contact, {
    title: 'اتصل بنا',
    lead: 'سؤال أو مشروع؟ نحن في خدمتك.',
    name: 'الاسم',
    email: 'البريد',
    subject: 'الموضوع',
    message: 'الرسالة',
    placeholderName: 'اسمك',
    placeholderEmail: 'you@example.com',
    chooseSubject: 'اختر موضوعًا',
    placeholderMessage: 'رسالتك...',
    send: 'إرسال',
    sending: 'جارٍ الإرسال...',
    sent: 'تم الإرسال. سنجيبك في أقرب وقت.',
    emailDisabled:
      'إرسال البريد معطّل: أضف VITE_EMAILJS_SERVICE_ID وVITE_EMAILJS_TEMPLATE_ID وVITE_EMAILJS_PUBLIC_KEY في ملف .env ثم أعد تشغيل npm run dev.',
    sendFailed:
      'فشل الإرسال. تحقق من وحدة التحكم (F12) وبيانات EmailJS وأسماء حقول القالب.',
    waCta: 'راسلنا على واتساب',
    subjects: ['سؤال عن طلب', 'سؤال عن منتج', 'إرجاع / استبدال', 'شراكة', 'أخرى'],
    addressLine: '123 شارع الجمهورية، تونس',
  });

  Object.assign(t.confirmation, {
    title: 'تم إرسال طلبك',
    subtitle: 'تم الإرسال! سنتواصل معك خلال ساعتين 🎉',
    orderNo: 'رقم {{id}}',
    home: 'العودة إلى الرئيسية',
  });

  Object.assign(t.about, {
    heroKicker: 'Chiraz · منذ 1978',
    heroTitle: 'قصتنا',
    heroLead: 'تميز الحرفية التونسية',
    storyTitle: 'قصتنا',
    storySub: 'دار تونسية · 1978 → اليوم',
    storyP1:
      'منذ 1978، تمثل شيراز تميز الحرفية التونسية: ورش حيث يُقطع الجلد ويُجمّع ويُنهّى بدقة، لأحذية فاخرة في متناول الجميع.',
    storyP2:
      'متوفرة في كل تونس، نربط الورشة بالزبون: بيع عبر الإنترنت وبكميات للشركاء الذين يشاركونا المعايير.',
    valuesTitle: 'قيمنا',
    countersTitle: 'منذ 1978',
    countersClients: 'عملاء راضون',
    countersLeather: 'جلد طبيعي',
    v1t: 'الحرفية',
    v1d: 'كل زوج يُصنع بتقنيات موروثة ورقابة جودة صارمة.',
    v2t: 'الاستدامة',
    v2d: 'مواد ومسؤولية لحذاء يدوم.',
    v3t: 'الأناقة',
    v3d: 'خطوط نقية وتفاصيل دقيقة.',
    e1t: 'تميز الحرفية التونسية',
    e1d: 'تقنيات موروثة وجودة صارمة، بفخر من تونس.',
    e2t: 'في كل تونس',
    e2d: 'توصيل وحضور يصلان شمالًا وجنوبًا.',
    e3t: 'أونلاين وجملة',
    e3d: 'اطلب أونلاين أو تعاون معنا بالكميات.',
    e4t: 'من الورشة إلى الزبون',
    e4d: 'سلسلة كاملة: قصّ وتجميع وتشطيب.',
  });

  Object.assign(t.returns, {
    title: 'سياسة الإرجاع',
    updated: 'آخر تحديث: يناير 2026',
    tocMobile: 'انتقل إلى القسم',
    tocPlaceholder: 'انتقل إلى القسم...',
    tocSidebar: 'فهرس',
    s1h: 'الشروط العامة',
    s2h: 'آجال الإرجاع',
    s3h: 'الإجراء',
    s4h: 'الاسترداد',
    s5h: 'استثناءات',
    s1p1:
      'يسمح لك Chiraz بإرجاع أو استبدال أي منتج مُشترى على chiraz.tn وفق الشروط أدناه. يجب أن تُعاد القطع بحالتها الأصلية غير الملبوسة.',
    s1p2:
      'يُستثنى المخصص أو المعلّم «تخفيضات — غير قابل للإرجاع» إلا في حالة عيب أو خطأ منا.',
    s2p:
      'لديك 30 يومًا تقويميًا من استلام الطرد لإبلاغنا برغبتك في الإرجاع أو الاستبدال.',
    s3intro: 'لبدء إرجاع أو استبدال:',
    s3li1: 'راسلنا على returns@chiraz.tn برقم الطلب والقطع.',
    s3li2: 'نرسل التعليمات وربما ملصق الإرجاع.',
    s3li3: 'عبّئ القطع بعناية وأودع الطرد عند الناقل المحدد.',
    s3li4: 'احتفظ بإثبات الإرسال حتى تأكيد الاسترداد أو الاستبدال.',
    s3p2: 'مصاريف الإرجاع على الزبون ما لم يكن العيب من عندنا.',
    s4p1: 'بعد الفحص يتم الاسترداد خلال 7–14 يومًا بنفس وسيلة الدفع.',
    s4p2: 'في الاستبدال، يُشحن المنتج الجديد بعد التحقق.',
    s5p1: 'قد نرفض الإرجاع إذا لم تُستوفَ الشروط.',
    s5p2: 'للأسئلة: returns@chiraz.tn أو نموذج الاتصال.',
    contactLink: 'اتصل بنا',
  });

  Object.assign(t.legal, {
    title: 'الإشعارات القانونية',
    updated: 'آخر تحديث: يناير 2026',
    editor: 'الناشر',
    editorBody: 'الموقع chiraz.tn منشور من قبل Chiraz. المقر: صفاقس، تونس.',
    hosting: 'الاستضافة',
    hostingBody: 'تتم الاستضافة لدى مزود تقني. للأسئلة: contact@chiraz.tn.',
    ip: 'الملكية الفكرية',
    ipBody: 'جميع المحتويات محمية. أي نسخ غير مصرّح به محظور.',
    contact: 'اتصل',
    contactBody: 'للأسئلة القانونية: contact@chiraz.tn.',
  });

  Object.assign(t.privacy, {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: يناير 2026',
    collected: 'البيانات المجمعة',
    collectedBody: 'قد نجمع الاسم والبريد والعنوان والهاتف وتفاصيل الطلبات لمعالجة الطلبات.',
    use: 'الاستخدام',
    useBody: 'تُستخدم البيانات للتسليم والدعم والتسويق بموافقتك.',
    rights: 'حقوقك',
    rightsBody: 'يمكنك الوصول أو التصحيح أو الحذف: contact@chiraz.tn.',
    security: 'الأمان',
    securityBody: 'نطبق تدابير لحماية بياناتك.',
  });

  Object.assign(t.currency, { long: 'دينار تونسي' });

  t.faq.title = 'الأسئلة الشائعة';
}

export const FAQ_EN = {
  delivery: {
    label: 'Delivery',
    items: [
      { q: 'What are the delivery times?', a: 'Standard delivery is 3–5 business days in Tunisia. Yalidine relay delivery may take 1–2 days depending on your governorate.' },
      { q: 'Do you deliver across Tunisia?', a: 'Yes, we deliver to all 58 governorates. Times may vary by area.' },
      { q: 'How can I track my order?', a: 'Once shipped, you receive a tracking number by email or SMS. Enter it in the “Track order” section on the site.' },
      { q: 'Are shipping fees fixed?', a: 'Fees depend on the option: home delivery (500 TND) or relay point (350 TND). They are shown before you confirm.' },
      { q: 'Can I change the address after ordering?', a: 'Yes, as long as the order has not shipped. Contact us by email or WhatsApp with your order number.' },
    ],
  },
  sizes: {
    label: 'Sizing',
    items: [
      { q: 'How do I choose my size?', a: 'Our shoes generally fit true to size. Check the size guide on each product page. If between sizes, we recommend sizing up.' },
      { q: 'Where is the size guide?', a: 'A “Size guide” link on each product page shows EU, UK, US and CM conversions.' },
      { q: 'Are sizes the same for shoes and sandals?', a: 'No. Grids can differ. Follow the guide on the relevant product page.' },
      { q: 'Can I exchange for another size?', a: 'Yes, under our returns policy (30 days, unworn item). See the Returns page for steps.' },
      { q: 'What if my size is out of stock?', a: 'Contact us to be notified of restock, or pick a similar model available in your size.' },
    ],
  },
  returns: {
    label: 'Returns',
    items: [
      { q: 'How long do I have to return an item?', a: 'You have 30 days after receipt to request a return or exchange, subject to conditions (unworn item, original packaging).' },
      { q: 'Who pays return shipping?', a: 'Return shipping is paid by the customer unless there is a defect or our error (wrong item, size, etc.).' },
      { q: 'How do I start a return?', a: 'Contact us at returns@chiraz.tn with your order number or via WhatsApp. We will send the label and instructions.' },
      { q: 'How is the refund issued?', a: 'Refunds go to the original payment method within 7–14 days after we receive and inspect the return.' },
      { q: 'Can I exchange for another model?', a: 'Yes. Tell us the new model and size. If a balance is due, we will let you know.' },
    ],
  },
  payment: {
    label: 'Payment',
    items: [
      { q: 'Which payment methods do you accept?', a: 'Cash on delivery (cash or postal account), bank transfer and prepaid cards depending on checkout options.' },
      { q: 'Is payment secure?', a: 'Yes. Online payments are processed by secure providers. We do not store your card details.' },
      { q: 'Can I pay in instalments?', a: 'Instalment options may be offered during certain campaigns. Check at checkout.' },
      { q: 'Is VAT included?', a: 'Prices include VAT. An invoice is sent with the order or on request.' },
      { q: 'What if there is a payment dispute?', a: 'Contact us with your order number and a description. We handle each case within 48 business hours.' },
    ],
  },
  products: {
    label: 'Products',
    items: [
      { q: 'Where do your leathers come from?', a: 'We select leathers from recognised tanneries. Material is stated on each product page.' },
      { q: 'How do I care for my shoes?', a: 'Use a soft cloth and suitable leather care products. Avoid excess water. Details are on the product page.' },
      { q: 'Do you offer bespoke models?', a: 'We do not offer bespoke for now. Our range covers common sizes with careful comfort.' },
      { q: 'Are photo colours accurate?', a: 'We strive for accurate colours. Screens can still alter perception.' },
      { q: 'What does “full-grain leather” mean?', a: 'Full-grain is the top leather layer, uncorrected. It is more durable and noble than corrected leather.' },
    ],
  },
};

export const FAQ_AR = {
  delivery: {
    label: 'التوصيل',
    items: [
      { q: 'ما مدة التوصيل؟', a: 'التوصيل القياسي خلال 3–5 أيام عمل في تونس. نقطة الالتقاط قد تكون خلال 1–2 يوم حسب الولاية.' },
      { q: 'هل توصلون إلى كل تونس؟', a: 'نعم، إلى الـ58 ولاية. المدد قد تختلف حسب المنطقة.' },
      { q: 'كيف أتتبع طلبي؟', a: 'بعد الشحن يصلك رقم تتبع بالبريد أو الرسائل. أدخله في قسم «تتبع الطلب».' },
      { q: 'هل رسوم الشحن ثابتة؟', a: 'تعتمد على الخيار: منزل (500 د.ت) أو نقطة استلام (350 د.ت). تُعرض قبل التأكيد.' },
      { q: 'هل يمكن تغيير العنوان بعد الطلب؟', a: 'نعم ما دام الطلب لم يُشحن. راسلنا بالبريد أو واتساب مع رقم الطلب.' },
    ],
  },
  sizes: {
    label: 'المقاسات',
    items: [
      { q: 'كيف أختار مقاسي؟', a: 'أحذيتنا غالبًا بحجمها الطبيعي. راجع دليل المقاس في صفحة المنتج. بين مقاسين ننصح بالأكبر.' },
      { q: 'أين دليل المقاس؟', a: 'رابط «دليل المقاس» في كل صفحة يوضح EU وUK وUS وسم.' },
      { q: 'هل المقاس واحد للأحذية والصنادل؟', a: 'لا، قد تختلف الجداول. اتبع دليل المنتج المعني.' },
      { q: 'هل يمكن الاستبدال لمقاس آخر؟', a: 'نعم ضمن سياسة الإرجاع (30 يومًا، غير ملبوس). راجع صفحة الإرجاع.' },
      { q: 'ماذا إذا نفد مقاسي؟', a: 'تواصل معنا لإشعارك بالتزويد أو اختر موديلًا مشابهًا متوفرًا.' },
    ],
  },
  returns: {
    label: 'الإرجاع',
    items: [
      { q: 'ما مهلة إرجاع المنتج؟', a: 'لديك 30 يومًا بعد الاستلام لطلب الإرجاع أو الاستبدال وفق الشروط (غير ملبوس، العبوة الأصلية).' },
      { q: 'من يدفع مصاريف الإرجاع؟', a: 'الزبون، ما لم يكن هناك عيب أو خطأ منا (منتج خاطئ، مقاس، إلخ).' },
      { q: 'كيف أبدأ الإرجاع؟', a: 'راسلنا returns@chiraz.tn برقم الطلب أو عبر واتساب. نرسل التعليمات والملصق إن لزم.' },
      { q: 'كيف يتم الاسترداد؟', a: 'على نفس وسيلة الدفع خلال 7–14 يومًا بعد الاستلام والفحص.' },
      { q: 'هل يمكن الاستبدال بموديل آخر؟', a: 'نعم. أخبرنا بالموديل والمقاس. إن وجد فرق بالسعر نُعلمك.' },
    ],
  },
  payment: {
    label: 'الدفع',
    items: [
      { q: 'ما وسائل الدفع؟', a: 'الدفع عند الاستلام (نقدًا أو بريدي)، تحويل وبطاقات مسبقة الدفع حسب خيارات الدفع.' },
      { q: 'هل الدفع آمن؟', a: 'نعم، عبر مزودين معتمدين. لا نخزن بيانات بطاقتك.' },
      { q: 'هل يمكن الدفع بالأقساط؟', a: 'قد تُعرض أحيانًا حسب الحملات. تحقق عند الطلب.' },
      { q: 'هل السعر شامل الضريبة؟', a: 'الأسعار شاملة. تُرسل فاتورة مع الطلب أو عند الطلب.' },
      { q: 'ماذا عند نزاع دفع؟', a: 'راسلنا برقم الطلب ووصف المشكلة. نعالج خلال 48 ساعة عمل.' },
    ],
  },
  products: {
    label: 'المنتجات',
    items: [
      { q: 'من أين جلودكم؟', a: 'من مدابغ معروفة. المادة مذكورة في صفحة كل منتج.' },
      { q: 'كيف أعتني بأحذيتي؟', a: 'قماش ناعم ومنتجات عناية للجلد. تجنب الماء الزائد. التفاصيل في صفحة المنتج.' },
      { q: 'هل لديكم تصنيع خاص؟', a: 'لا حاليًا. نغطي المقاسات الشائعة براحة مدروسة.' },
      { q: 'هل ألوان الصور دقيقة؟', a: 'نسعى للدقة لكن الشاشة قد تغيّر الإدراك.' },
      { q: 'ما معنى «جلد full grain»؟', a: 'هو الطبقة العليا غير المصححة، أكثر متانة وأرقى من الجلد المصحح.' },
    ],
  },
};
