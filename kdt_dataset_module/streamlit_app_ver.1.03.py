import streamlit as st
import os
from dotenv import load_dotenv

load_dotenv()

st.title("Streamlit App Test")
st.write("Environment Variables:", os.environ)
st.write("App is running")