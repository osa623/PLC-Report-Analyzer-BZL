from fastapi import FastAPI
from routes.company_routes import router
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="CSE Company Service")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/companies")