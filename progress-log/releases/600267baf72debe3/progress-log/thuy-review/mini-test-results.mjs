// Điểm Mini Test đọc trên Portal IC2305 ngày 22/10/2026; mã người đã đối chiếu roster máy chủ.
// Ô thiếu giữ null; không suy điểm Writing, band hoặc nhận xét từ Listening/Reading.
export const miniSource={url:'https://portal.izone.edu.vn/academic-affairs/course-classes/1294/tests',observedDate:'2026-10-22',classId:'1294'};
const rows=[
 ['e266f04b-01db-46ea-bb36-f61a5736545c',5,5],
 ['d3eb7c60-2ca3-41ff-8d27-e4f09f14210a',2,4],
 ['e988230c-995b-4b23-87b7-fb9ae7f663ac',6,8],
 ['106529db-117e-4169-a04c-3c3ac01911ba',7,6],
 ['4aa81820-8d59-4820-ab9a-88aab63f2fd3',6,12],
 ['7d29eff2-7423-43be-a53b-1a36882ba348',10,12],
 ['44f918e4-2b3a-424b-ae77-bdd03ec2c5e6',4,2],
 ['8e94c010-b60a-4e16-9124-80082300f563',7,11],
 ['930f33a1-5910-4bdc-8fb2-f2f977edd3e0',7,9],
 ['01309129-7735-4286-a4da-677978c4b63c',5,8],
 ['c4a6e487-1716-4f9b-bb79-c2a0c2cae9b4',9,10],
 ['f5d0d728-bd9f-4da3-beee-060aefc82296',6,4],
 ['1a5d845a-0267-474d-bbb1-9c2bdab6d930',null,null],
 ['8c3c2a10-90c3-4e7e-b6ac-88eac08ae7f1',5,7],
 ['eb498ca3-5a19-4a34-b7e3-52abaafa9490',4,5],
 ['6d9f7f2f-4482-4f5a-9401-1096f1c9e254',3,3],
 ['143a2ffa-1887-4f89-bfad-32bfb4079e8e',6,8],
 ['eb60a5e0-fb13-4fec-a2cb-f16ef1b3164a',null,null]
];
export const miniResults=rows.map(([studentRef,listening,reading])=>({studentRef,result:{
 testSlug:'mini-test-lesson-5',title:'Mini Test',source:miniSource,synthetic:false,
 listening:listening===null?null:{correct:listening,total:10},
 reading:reading===null?null:{correct:reading,total:13},writing:null
}}));
