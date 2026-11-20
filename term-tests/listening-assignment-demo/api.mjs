const base='https://ducizone.ddns.net/substitute-teacher-api/listening-assignment-demo/v1/';
export const studentUrl='https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/ic2311-listening-retake-substitute1-k56/?course=56';
export const activeKey='izone:substitute-listening-pilot:active';

export async function call(route,{token,teacher=false,body,binary=false}={}) {
    const headers={};
    if (body!==undefined) Object.assign(headers,{'Content-Type':'application/json','X-Izone-Csrf':'1'});
    if (token) headers.Authorization=`Bearer ${token}`;
    const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers,
        body:body===undefined?undefined:JSON.stringify(body),credentials:teacher?'include':'omit',
        redirect:'error',cache:'no-store',signal:AbortSignal.timeout(14000)});
    if (!response.ok) {
        const {code} = await response.json().catch(()=>({}));
        throw Object.assign(Error(code||'PILOT_UNAVAILABLE'),{code,status:response.status});
    }
    return binary?response.blob():response.json();
}
