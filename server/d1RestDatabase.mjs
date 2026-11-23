// Match D1's binding interface while keeping values bound in REST batch requests.
export function createD1RestDatabase({account,token,databaseId,fetcher=fetch}) {
  const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${databaseId}/query`;
  async function query(payload) {
    const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
    const body=await response.json();
    if(!response.ok||!body.success||body.result?.some(row=>!row.success)) {
      // Preserve constraint categories for optimistic-concurrency handling without exposing SQL or data.
      const messages=JSON.stringify(body.errors||[]);
      const missingTable = messages.match(/no such table:\s*([a-zA-Z_][a-zA-Z0-9_]*)/i)?.[1];
      if (missingTable) throw Object.assign(new Error('Company database unavailable.'), { code: 'SQLITE_MISSING_TABLE', table: missingTable });
      if(/CHECK constraint/i.test(messages))throw new Error('CHECK constraint failed.');
      if(/UNIQUE constraint/i.test(messages))throw new Error('UNIQUE constraint failed.');
      throw new Error('Company database unavailable.');
    }
    return body.result;
  }
  function prepare(sql,params=[]) {return {sql,params,bind(...values){return prepare(sql,values);},async first(){return (await query({sql,params}))[0].results[0]||null;},async all(){return (await query({sql,params}))[0];},async run(){return (await query({sql,params}))[0];}};}
  return {prepare,batch:statements=>query({batch:statements.map(({sql,params})=>({sql,params}))})};
}
