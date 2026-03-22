from fakeredis import TcpFakeServer


def main() -> None:
    server = TcpFakeServer(("127.0.0.1", 6379), server_type="redis", bind_and_activate=True)
    print("Fake Redis server listening on 127.0.0.1:6379")
    server.serve_forever()


if __name__ == "__main__":
    main()
