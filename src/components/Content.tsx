import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import * as React from "react";
import styled from "styled-components";
import shallow from "zustand/shallow";
import { ATLAS_DECIMAL, USDC_DECIMAL, CONN, PALLETE } from "../constants";
import { useAppStore, useFleetStore } from "../data/store";
import {
  ErrorModalTypes,
  InfoModalTypes,
  WaitingSignature
} from "../data/types";
import { FleetService } from "../services/fleetService";
import { MarketService } from "../services/marketService";
import { thousandsFormatter } from "../utils";
import { AtlasIcon } from "./Atlas";
import Resources from "./Resources";
import { Container } from "./shared/styled/Styled";
import { ReactComponent as LoadingSpinner } from "../assets/images/spinner.svg";
import { number } from "mathjs";

export const Content = () => {
  const fleets = useFleetStore((state) => state.fleets);
  const {
    isAppLoading,
    startAppLoading,
    stopAppLoading,
    setErrorModal,
    setInfoModal,
    setSignaturesToWait,
  } = useAppStore(
    (state) => ({
      isAppLoading: state.appLoading,
      startAppLoading: state.startAppLoading,
      stopAppLoading: state.stopAppLoading,
      setInfoModal: state.setInfoModal,
      setErrorModal: state.setErrorModal,
      setSignaturesToWait: state.setSignaturesToWait,
    }),
    shallow
  );
  const [totalClaim, setTotalClaim] = React.useState(0);
  const [totalDay, setTotalDay] = React.useState(0);
  const { publicKey, signAllTransactions, signTransaction } = useWallet();
  const isRefreshing = useAppStore((state) => state.refreshing);

  const onRefresh = () => {
    if (publicKey) {
      FleetService.refresh(publicKey);
    }
  };

  React.useEffect(() => {
    if (fleets.length > 0) {
      setTotalClaim(FleetService.getPendingAtlas());
      setTotalDay(FleetService.getRewardPerDay())
    }
  }, [fleets]);

  let [usd_price, setUsdPrice] = React.useState([] as any);

  React.useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=star-atlas&vs_currencies=usd')
      .then((res) => res.json())
      .then((result) => {
        console.dir(result['star-atlas']);
        setUsdPrice(result['star-atlas'].usd);
        console.dir(typeof(usd_price));
      });
  }, []);

  const onClaimAllClick = async () => {
    if (publicKey && signAllTransactions && signTransaction) {
      try {
        const ixs = await MarketService.getHarvestAllInstructions(publicKey);

        const biIxs: [Transaction, Transaction][] = [...ixs].reduce(
          (g: any[], c) => {
            if (g.length > 0) {
              if (g[g.length - 1].length == 2) {
                g.push([c]);
              } else {
                g[g.length - 1].push(c);
              }
            } else {
              g.push([c]);
            }
            return g;
          },
          [] as any[]
        );

        const latestBlockHash = await (
          await CONN.getRecentBlockhash("finalized")
        ).blockhash;

        const txs = biIxs.map((biIx) =>
          new Transaction({
            feePayer: publicKey,
            recentBlockhash: latestBlockHash,
          }).add(...biIx)
        );

        const signedTxs = await signAllTransactions(txs);

        const signatures = await Promise.all(
          signedTxs.map((signedTx) =>
            CONN.sendRawTransaction(signedTx.serialize())
          )
        );

        const waitingSigntaures = signatures.map<WaitingSignature>(
          (signature) => ({ hash: signature, status: "processing" })
        );
        setSignaturesToWait(waitingSigntaures);
        FleetService.checkSignatures(waitingSigntaures);

        setInfoModal({
          modalType: InfoModalTypes.TX_LIST,
          message: `Transactions are Sent. Please track them with Solscan using the following links:`,
          list: signatures,
        });
      } catch (error) {
        console.log(error);
        setErrorModal({
          modalType: ErrorModalTypes.NORMAL,
          message:
            "An error happened while sending transaction. Please try again later.",
        });
      } finally {
        stopAppLoading();
      }
    }
  };

  return (
    <Wrapper>
      <Container>
        <ContentWrapper>
          <PendingSection>
            <Title align="center">PENDING REWARDS</Title>
            <div>
              <AtlasIcon width={"100%"} height={100} />
              <h2 style={{marginTop:16}}>{thousandsFormatter(totalClaim, ATLAS_DECIMAL)} (${(usd_price * totalClaim).toFixed(3)})</h2>
              <h3>{thousandsFormatter(totalDay, ATLAS_DECIMAL)} (24h) (${(usd_price * totalDay).toFixed(3)})</h3>
              {/* <h2 style={{marginTop:16}}>${usd_price.toFixed(3)}</h2>
              <h2 style={{marginTop:16}}></h2> */}
              
            </div>
            <PrimaryBtn onClick={onClaimAllClick}>CLAIM ALL</PrimaryBtn>
          </PendingSection>

          <div style={{width:10}}></div>

          <ResourcesSection>
          
            <Resources />
            <Container>
            <div
              style={{
                width: "100%",
                justifyContent: "end",
                display: "flex",
                marginTop: 20,
              }}
            >
              {publicKey ? (
                <RefreshButton disabled={isRefreshing} onClick={onRefresh}>
                  {isRefreshing ? (
                    <>
                      REFRESHING <LoadingSpinner style={{ marginLeft: 8 }} />
                    </>
                  ) : (
                    "REFRESH"
                  )}{" "}
                </RefreshButton>
              ) : (
                <></>
              )}
            </div>
          </Container>
          </ResourcesSection>
        </ContentWrapper>
      </Container>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  width: 100%;
`;

const ContentWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 16px 0;

  @media ${PALLETE.DEVICE.mobileL} {
    flex-direction: column;
    justify-content: space-between;
  }
`;

const PrimaryBtn = styled.button`
  padding: 8px 16px;
  border-radius: 4px;
  height: 34px;
  background-color: ${PALLETE.CLUB_RED};
  color: ${PALLETE.FONT_COLOR};
  cursor: pointer;
  &:active {
    background-color: ${PALLETE.CLUB_RED_HOVER};
  }
`;

const ResourcesSection = styled.div`
  color: ${PALLETE.FONT_COLOR};
  flex: 5;
  border-radius: 4px;
  background-color: ${PALLETE.PRIMARY_BG_COLOR};
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  @media ${PALLETE.DEVICE.mobileL} {
    flex-direction: column;
    justify-content: space-between;
    margin: 16px 8px;
  }
`;

const Title = styled.h1<{ align?: string }>`
  text-align: ${(p) => p.align ?? "left"};
`;

const PendingSection = styled.div`
  color: ${PALLETE.FONT_COLOR};
  flex: 2;
  border-radius: 4px;
  background-color: ${PALLETE.PRIMARY_BG_COLOR};
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;

  @media ${PALLETE.DEVICE.mobileL} {
    flex-direction: column;
    justify-content: space-between;
    margin: 16px 8px;
    min-height: 360px;
  }
`;

const RefreshButton = styled.button`
  border: 1px solid ${PALLETE.CLUB_RED};
  color: ${PALLETE.CLUB_RED};
  font-size: ${PALLETE.FONT_SM};
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 4px;
  &:hover {
    color: ${PALLETE.CLUB_RED_HOVER};
    border: 1px solid ${PALLETE.CLUB_RED_HOVER};
  }
`;
