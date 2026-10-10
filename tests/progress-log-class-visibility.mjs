// Dữ liệu giả: kiểm danh sách mặc định và giữ lớp chưa có phiếu cho bộ soạn.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../progress-log/teacher.js',import.meta.url),'utf8');
test('Thủy: Hành trình mặc định chỉ lớp có Progress Log, vẫn có lựa chọn đọc lớp được cấp khác',async()=>{
 const showAll={checked:false},elements={overviewClassSelect:{value:''},teacherClassSelect:{},teacherName:{},teacherAccessView:{},teacherWorkspace:{}};
 const state={authGeneration:1},selected=new Map();let editorClasses,loaded=0;
 const classes=[{class_id:'1294',class_name:'IC2305'},{class_id:'1200',class_name:'IC2264'},{class_id:'1000',class_name:'Lớp đã dạy'}];
 const context={state,elements,document:{getElementById(){return showAll;}},setNotice(){},renderLibrary(){},switchPanel(){},refreshAssignmentSelect(){},
  formEditor:{setWorkspace(value){editorClasses=value.classes;}},loadCourseOverview(){loaded++;},
  fillSelect(element,rows){selected.set(element,rows);element.value=rows[0]?.class_id || '';},
  apiRequest:async path=>path.endsWith('/options')?{reviewer:{name:'Giảng viên giả'},classes,assignments:[{class_id:'1294',session_number:8}]}:{items:[]}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function loadWorkspace()'),source.indexOf('async function publishReflection(')),context);
 await context.loadWorkspace();assert.deepEqual(selected.get(elements.overviewClassSelect).map(c=>c.class_name),['IC2305']);
 assert.equal(editorClasses.length,3);assert.equal(selected.get(elements.teacherClassSelect).length,3);
 showAll.checked=true;showAll.onchange();assert.equal(selected.get(elements.overviewClassSelect).length,3);assert.equal(loaded,1);
 showAll.checked=false;showAll.onchange();assert.equal(selected.get(elements.overviewClassSelect).length,1);
});
