export const FONTFIX_GAME = {
  id: 'dissidia-012-thai-v1-3',
  name: 'Dissidia 012', platform: 'PSP',
  format: 'XDELTA', streaming: true, version: 'v1.3 FontFix TEST',
  cover: 'covers/Dissidia_012_Thai_v1.0.png',
  desc: 'แก้การโหลดฟอนต์ไทยสำหรับ PSP / PSP Go รองรับทั้ง EUR FULL UNDUB และ ISO ไทย v1.3 ระบบตรวจไฟล์และเลือกแพตช์ให้อัตโนมัติ รุ่นทดลอง: ยังต้องยืนยันบนเครื่องจริง',
  sourceName: 'EUR FULL UNDUB หรือ ISO ไทย v1.3 ที่ตรงกับรุ่นที่รองรับ',
  sourceSize: 1741168640,
  sourceSha256: '5877d20b328f45315251c6c605230e3a442ca0bffb51f54e9750e27329650e6c',
  targetSize: 1751283712,
  targetSha256: '04b201e5bbf718c18a614628b64333d18829888cdb93654ac513e82ad7ef1af7',
  outName: 'Dissidia_012_Thai_v1.3_PSP_FontFix_TEST.iso',
  sources: [
    {name:'EUR FULL UNDUB', size:1741168640, sha256:'5877d20b328f45315251c6c605230e3a442ca0bffb51f54e9750e27329650e6c', patchUrl:'patches/FROM_EUR_FULL_UNDUB_TO_Thai_v1.3_PSP_FontFix_TEST.xdelta', patchSha256:'bda678530aad598f3bcf796226ce6c0b9518e58f76822902c35fe0edebff2391', patchSize:6600311},
    {name:'ไทย v1.3', size:1751244800, sha256:'2a466b3bae3a67745cb86df738ed4f0327898f72a373cfe278ba7e2b5d9569e6', patchUrl:'patches/FROM_Thai_v1.3_TO_PSP_FontFix_TEST.xdelta', patchSha256:'4d0018f68215f142bda88e89533ed1be3cf18f61261863e44ddd3cdd685728e0', patchSize:32451}
  ]
};
