import { TextField, MenuItem, Paper, Box } from '@mui/material';

export default function ProjectDetailsTab({ project, regions, updateProject }) {
  return (
    <Paper sx={{ p: 4, maxWidth: 600, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
      <Box display="flex" flexDirection="column" gap={3}>
        <TextField 
          label="PROJECT_NAME" 
          value={project.name} 
          onChange={e => updateProject("name", e.target.value)} 
          fullWidth 
        />
        <TextField 
          label="CLIENT_NAME" 
          value={project.clientName} 
          onChange={e => updateProject("clientName", e.target.value)} 
          fullWidth 
        />
        <TextField 
          select 
          label="RATES_REGION" 
          value={project.region} 
          onChange={e => updateProject("region", e.target.value)} 
          fullWidth 
          helperText="Leave empty to use default rates"
        >
          <MenuItem value="">-- AUTO_DETECT_FIRST_RATE --</MenuItem>
          {regions.map(r => (
            <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
          ))}
        </TextField>
      </Box>
    </Paper>
  );
}