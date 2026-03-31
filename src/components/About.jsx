import { Box, Typography, Button, Paper } from "@mui/material";

export default function About({ onBack }) {
    return (
        <Box sx={{ maxWidth: 800, margin: "40px auto", padding: "20px" }}>
            <Button onClick={onBack} sx={{ mb: 3 }}>← Back to Home</Button>

            <Paper elevation={3} sx={{ padding: "40px", borderRadius: "12px" }}>
                <Typography variant="h3" gutterBottom fontWeight="bold" color="primary">
                    TechQuest Construction Estimator
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" paragraph>
                    Version 1.0.0 | Professional Estimation Solution
                </Typography>

                <Box sx={{ my: 4 }}>
                    <Typography variant="h5" gutterBottom fontWeight="medium">
                        About the App
                    </Typography>
                    <Typography variant="body1" paragraph lineHeight={1.8}>
                        This application is designed to streamline the civil engineering and construction
                        estimation process. It bridges the gap between raw master databases, local market rates (LMR),
                        and project-specific Bill of Quantities (BOQ).
                    </Typography>
                    <Typography variant="body1" paragraph lineHeight={1.8}>
                        By supporting nested assemblies, recursive rate calculations, and dynamic measurement books,
                        it ensures that every project is priced accurately based on regional variables and live market data.
                    </Typography>
                </Box>

                <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: "divider" }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                        Created by Gokul DC.
                        For TechQuest Innovations Pvt. Ltd.
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
}