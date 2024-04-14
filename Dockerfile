WORKDIR /proxy
FROM python:3.12.2
COPY proxy/requirements.txt requirements.txt
RUN pip install -r requirements.txt
COPY proxy/main.py main.py
EXPOSE 8051
CMD ["python", "main.py"]
