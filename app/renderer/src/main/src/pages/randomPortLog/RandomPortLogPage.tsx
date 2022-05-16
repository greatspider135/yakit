import React, {useEffect, useState} from "react";
import {AutoCard} from "../../components/AutoCard";
import {Alert, Button, Divider, Form, Space, Spin, Table, Tag, Tooltip} from "antd";
import {useMemoizedFn} from "ahooks";
import {randomString} from "../../utils/randomUtil";
import {CopyableField, InputInteger} from "../../utils/inputUtil";
import {formatTimestamp} from "../../utils/timeUtil";
import {ReloadOutlined} from "@ant-design/icons";
import {showModal} from "../../utils/showModal";
import {YakEditor} from "../../utils/editors";

export interface RandomPortLogPageProp {

}

const {ipcRenderer} = window.require("electron");

interface RandomPortTriggerNotification {
    History?: string[]
    RemoteAddr: string
    RemotePort: number
    RemoteIP: string
    LocalPort: number
    CurrentRemoteCachedConnectionCount: number
    LocalPortCachedHistoryConnectionCount: number
    Timestamp: number
    TriggerTimestamp: number
}

export const RandomPortLogPage: React.FC<RandomPortLogPageProp> = (props) => {
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState<string>("");
    const [externalAddr, setExternalAddr] = useState("");
    const [randomPort, setRandomPort] = useState(0);
    const [notification, setNotification] = useState<RandomPortTriggerNotification[]>([]);

    const refreshPort = useMemoizedFn(() => {
        setLoading(true)
        ipcRenderer.invoke("RequireRandomPortToken", {}).then((d: { Token: string, Addr: string, Port: number }) => {
            setToken(d.Token)
            setExternalAddr(d.Addr)
            setRandomPort(d.Port)
            setNotification([])
        }).catch(() => {
            setNotification([])
        }).finally(() => {
            setTimeout(() => {
                setLoading(false)
            }, 400)
        })
    })

    useEffect(() => {
        if (token !== "") {
            update()
            const id = setInterval(update, 4000)
            return () => {
                clearInterval(id)
            }
        }
    }, [token])

    useEffect(refreshPort, [])

    const update = useMemoizedFn(() => {
        ipcRenderer.invoke("QueryRandomPortTrigger", {
            Token: token
        }).then((d: RandomPortTriggerNotification) => {
            if (d?.RemoteAddr !== "") {
                setNotification([d])
            }
        }).catch(() => {
        })
    })

    return <AutoCard bordered={false} title={<Space>
        Random Port Logger
        <div style={{color: "#999", fontSize: 12}}>
            使用未开放的随机端口来判定 TCP 反连
        </div>
        <Divider type={"vertical"}/>
        <Form onSubmitCapture={e => {
            e.preventDefault()

            refreshPort()
        }} size={"small"} layout={"inline"}>
            <InputInteger label={"当前随机端口"} value={randomPort} disable={true} setValue={() => {
            }}/>
            <Form.Item colon={false} label={" "}>
                <Button disabled={loading} type="primary" htmlType="submit"> 申请随机端口 </Button>
            </Form.Item>
            <Button disabled={loading} type="link" onClick={() => {
                update()
            }} icon={<ReloadOutlined/>}> 刷新 </Button>
        </Form>
    </Space>}>
        <Space direction={"vertical"} style={{width: "100%"}}>
            <Alert type={"success"} message={<Space style={{width: "100%"}} direction={"vertical"}>
                <h4>使用以下随机端口尝试触发记录</h4>
                {externalAddr !== "" && !loading ? <Space direction={"vertical"}>
                    <CopyableField text={externalAddr}/>
                    <Space>
                        使用 NC 命令<CopyableField mark={true} text={`nc ${externalAddr.replaceAll(":", " ")}`}/>
                    </Space>
                </Space> : <Spin/>}
                {randomPort > 0 && !loading ? <CopyableField text={`${randomPort}`}/> : <Spin/>}
            </Space>}>

            </Alert>
            <Table<RandomPortTriggerNotification>
                size={"small"}
                pagination={false}
                rowKey={i => `${i?.RemoteAddr || randomString(12)}`}
                dataSource={notification}
                columns={[
                    {title: "随机反连端口", render: (i: RandomPortTriggerNotification) => i?.LocalPort},
                    {
                        title: "远端地址",
                        render: (i: RandomPortTriggerNotification) => <CopyableField text={i?.RemoteAddr}/>
                    },
                    {
                        title: "同主机其他连接(一分钟内)",
                        render: (i: RandomPortTriggerNotification) => i?.CurrentRemoteCachedConnectionCount || 1
                    },
                    {
                        title: "同端口历史(一分钟内)",
                        render: (i: RandomPortTriggerNotification) => <Tooltip
                            title={`对当前端口(${i?.LocalPort})来说，除了当前连接，还有${i?.LocalPortCachedHistoryConnectionCount || 1}个来自其他远端的连接`}>
                            <a href="#" onClick={(e) => {
                                e.preventDefault()

                                showModal({
                                    title: "查看历史记录",
                                    width: "40%",
                                    content: (
                                        <>
                                            <YakEditor
                                                type={"http"}
                                                readOnly={true}
                                                value={i?.History ? i.History.join("\n") : "-"}
                                            />
                                        </>
                                    )
                                })
                            }}>
                                其他连接：{i?.LocalPortCachedHistoryConnectionCount || 1}
                            </a>
                        </Tooltip>
                    },
                    {
                        title: "触发时间",
                        render: (i: RandomPortTriggerNotification) => <Tag>{formatTimestamp(i.TriggerTimestamp)}</Tag>
                    },
                ]}
            >

            </Table>
        </Space>
    </AutoCard>
};