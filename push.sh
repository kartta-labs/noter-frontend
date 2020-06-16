sudo docker build -t make_sense .
sudo docker stop make_sense
sudo docker rm make_sense
sudo docker run -dit -p 80:3000 --restart=always --name=make_sense make_sense
