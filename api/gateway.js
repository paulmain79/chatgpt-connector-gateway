// ChatGPT Connector Gateway - Gives ChatGPT arms and legs
// Connect GitHub, Vercel, Google Sheets, and more

export default async function handler(req, res) {
  // Enable CORS for ChatGPT
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple auth check
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.GATEWAY_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing API key' 
    });
  }

  const { service, action, params } = req.body;

  // Log for debugging
  console.log(`Request: ${service}/${action}`, params);

  try {
    let result;
    
    switch (service) {
      case 'github':
        result = await handleGitHub(action, params);
        break;
      case 'vercel':
        result = await handleVercel(action, params);
        break;
      case 'sheets':
        result = await handleSheets(action, params);
        break;
      case 'supabase':
        result = await handleSupabase(action, params);
        break;
      default:
        return res.status(400).json({ 
          error: 'Unknown service',
          available: ['github', 'vercel', 'sheets', 'supabase'] 
        });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Gateway error:', error);
    return res.status(500).json({ 
      error: 'Gateway error',
      message: error.message 
    });
  }
}

async function handleGitHub(action, params) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GitHub token not configured');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  const baseUrl = 'https://api.github.com';
  
  switch (action) {
    case 'create_issue': {
      const response = await fetch(
        `${baseUrl}/repos/${params.repo}/issues`,
        { 
          method: 'POST', 
          headers, 
          body: JSON.stringify(params.data) 
        }
      );
      return await response.json();
    }
    
    case 'trigger_workflow': {
      const response = await fetch(
        `${baseUrl}/repos/${params.repo}/actions/workflows/${params.workflow}/dispatches`,
        { 
          method: 'POST', 
          headers, 
          body: JSON.stringify({ 
            ref: params.ref || 'main', 
            inputs: params.inputs 
          }) 
        }
      );
      return { 
        success: response.ok,
        status: response.status,
        workflow: params.workflow 
      };
    }
    
    case 'get_file': {
      const response = await fetch(
        `${baseUrl}/repos/${params.repo}/contents/${params.path}`,
        { headers }
      );
      const data = await response.json();
      if (data.content) {
        data.decoded = Buffer.from(data.content, 'base64').toString();
      }
      return data;
    }
    
    case 'update_file': {
      const getResponse = await fetch(
        `${baseUrl}/repos/${params.repo}/contents/${params.path}`,
        { headers }
      );
      const fileData = await getResponse.json();
      
      const response = await fetch(
        `${baseUrl}/repos/${params.repo}/contents/${params.path}`,
        { 
          method: 'PUT', 
          headers, 
          body: JSON.stringify({
            message: params.message || 'Update from ChatGPT',
            content: Buffer.from(params.content).toString('base64'),
            sha: fileData.sha
          }) 
        }
      );
      return await response.json();
    }
    
    default:
      throw new Error(`Unknown GitHub action: ${action}`);
  }
}

async function handleVercel(action, params) {
  switch (action) {
    case 'deploy': {
      const hookUrl = params.production 
        ? process.env.VERCEL_PROD_HOOK 
        : process.env.VERCEL_PREVIEW_HOOK;
      
      if (!hookUrl) {
        throw new Error(`Vercel ${params.production ? 'production' : 'preview'} hook not configured`);
      }
      
      const response = await fetch(hookUrl, { method: 'POST' });
      return { 
        deployment: 'triggered', 
        production: params.production,
        status: response.ok ? 'success' : 'failed' 
      };
    }
    
    default:
      throw new Error(`Unknown Vercel action: ${action}`);
  }
}

async function handleSheets(action, params) {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    return { 
      error: 'Google Sheets not configured',
      setup: 'Add GOOGLE_SHEETS_API_KEY to environment variables' 
    };
  }
  
  const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  
  switch (action) {
    case 'get_values': {
      const response = await fetch(
        `${baseUrl}/${params.spreadsheetId}/values/${params.range}?key=${apiKey}`
      );
      return await response.json();
    }
    
    case 'update_values': {
      const response = await fetch(
        `${baseUrl}/${params.spreadsheetId}/values/${params.range}?valueInputOption=RAW&key=${apiKey}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: params.values })
        }
      );
      return await response.json();
    }
    
    default:
      throw new Error(`Unknown Sheets action: ${action}`);
  }
}

async function handleSupabase(action, params) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return { 
      error: 'Supabase not configured',
      setup: 'Add SUPABASE_URL and SUPABASE_ANON_KEY to environment variables' 
    };
  }
  
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  
  switch (action) {
    case 'query': {
      const response = await fetch(
        `${url}/rest/v1/${params.table}?${params.query || ''}`,
        { headers }
      );
      return await response.json();
    }
    
    case 'insert': {
      const response = await fetch(
        `${url}/rest/v1/${params.table}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(params.data)
        }
      );
      return await response.json();
    }
    
    default:
      throw new Error(`Unknown Supabase action: ${action}`);
  }
}