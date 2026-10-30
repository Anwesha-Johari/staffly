
import streamlit as st

st.set_page_config(
    page_title="Employee Management System",
    page_icon="👥",
    layout="wide"
)

st.title("Employee Management System")

st.success("Streamlit is working successfully!")

st.write(
    "Welcome to our Employee Management System."
)

st.subheader("Application Setup")

st.info(
    "Our frontend will be connected to the existing "
    "Python backend and MySQL database."
)
