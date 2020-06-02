# If you want to run manually...
# docker build --build-arg SERIAL=YOURSERIALVAL -t YOURIMAGENAME .  
# docker run --rm --name YOURCONTAINERNAME -p 9000:9000 -it YOURIMAGENAME

FROM node:12
RUN apt-get update -y

WORKDIR /opt/app

# node packages
COPY package*.json ./
RUN npm install

#----------------------------------------
# Your app dependencies.
#----------------------------------------
# RUN apt-get install -y something-nice-package

#----------------------------------------
# Bootstraps
#----------------------------------------
ARG SERIAL=unknown

COPY ./burden ./burden

EXPOSE 9000
CMD [ "npx", "colloquist", "server" ]